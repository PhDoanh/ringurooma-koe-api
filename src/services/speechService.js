/**
 * @file speechService.js
 * @description Dịch vụ xử lý nhận dạng và chấm điểm phát âm tiếng Nhật bằng Azure Speech SDK
 */

const sdk = require('microsoft-cognitiveservices-speech-sdk');
const fs = require('fs');
const { config } = require('../../config');
const crypto = require('crypto');
const NodeCache = require('node-cache');
const { retry } = require('async');

// Khởi tạo cache với thời gian sống 5 phút
const resultCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Dịch vụ Speech Service cung cấp các chức năng nhận dạng và đánh giá phát âm tiếng Nhật
 */
class SpeechService {
	constructor() {
		// Kiểm tra xem thông tin cấu hình đã được cung cấp đầy đủ chưa
		if (!config.azure.speech.key || !config.azure.speech.region) {
			throw new Error('Thiếu thông tin cấu hình Azure Speech Service key/region');
		}

		// Tạo speech config từ các thông tin trong biến môi trường
		this.speechConfig = sdk.SpeechConfig.fromSubscription(
			config.azure.speech.key,
			config.azure.speech.region
		);

		// Cấu hình ngôn ngữ là tiếng Nhật
		this.speechConfig.speechRecognitionLanguage = 'ja-JP';

		// Thiết lập tùy chọn bổ sung cho đánh giá
		this.speechConfig.setProperty("PronunciationAssessment_EnableProsodyAssessment", "true"); // Bật đánh giá ngữ điệu
		this.speechConfig.setProperty("PronunciationAssessment_EnableContentAssessmentWithTopic", "true"); // Bật đánh giá nội dung
		this.speechConfig.setProperty("PronunciationAssessment_EnableMiscue", "true"); // Bật phát hiện lỗi

		console.log('Đã khởi tạo Speech Service với cấu hình tiếng Nhật (ja-JP)');
	}

	/**
	 * Nhận dạng văn bản từ file âm thanh
	 * @param {string} audioFilePath - Đường dẫn tới file âm thanh cần nhận dạng
	 * @returns {Promise<string>} - Văn bản được nhận dạng từ âm thanh
	 */
	async recognizeSpeech(audioFilePath) {
		return retry(
			{ times: 3, interval: 1000, errorFilter: (err) => this._isRetryableError(err) },
			async () => {
				return new Promise((resolve, reject) => {
					try {
						// Tạo cache key từ hash của file audio
						const audioHash = crypto.createHash('md5').update(fs.readFileSync(audioFilePath)).digest('hex');
						const cacheKey = `stt_${audioHash}`;

						// Kiểm tra cache
						const cachedResult = resultCache.get(cacheKey);
						if (cachedResult) {
							console.log(`Cache hit for speech recognition: ${cacheKey}`);
							return resolve(cachedResult);
						}

						// Đọc nội dung file âm thanh
						const audioContent = fs.readFileSync(audioFilePath);

						// Tạo audio config từ nội dung file âm thanh
						const audioConfig = sdk.AudioConfig.fromWavFileInput(audioContent, audioFilePath);

						// Tạo speech recognizer
						const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

						// Xử lý kết quả nhận dạng
						recognizer.recognizeOnceAsync(
							(result) => {
								// Kiểm tra kết quả
								if (result.reason === sdk.ResultReason.RecognizedSpeech) {
									// Lưu vào cache
									resultCache.set(cacheKey, result.text);
									resolve(result.text);
								} else {
									reject(new Error(`Lỗi nhận dạng giọng nói: ${result.reason}`));
								}

								// Giải phóng tài nguyên
								recognizer.close();
							},
							(err) => {
								reject(err);
								recognizer.close();
							}
						);
					} catch (error) {
						reject(error);
					}
				});
			}
		);
	}

	/**
	 * Đánh giá phát âm tiếng Nhật từ file âm thanh
	 * @param {string} audioFilePath - Đường dẫn tới file âm thanh
	 * @param {string} referenceText - Văn bản tham chiếu để đánh giá phát âm
	 * @returns {Promise<Object>} - Kết quả đánh giá phát âm
	 */
	async assessPronunciation(audioFilePath, referenceText) {
		return retry(
			{ times: 3, interval: 1000, errorFilter: (err) => this._isRetryableError(err) },
			async () => {
				return new Promise((resolve, reject) => {
					try {
						// Tạo cache key từ hash của file audio và reference text
						const audioHash = crypto.createHash('md5').update(fs.readFileSync(audioFilePath)).digest('hex');
						const cacheKey = `pronunciation_${audioHash}_${referenceText}`;

						// Kiểm tra cache
						const cachedResult = resultCache.get(cacheKey);
						if (cachedResult) {
							console.log(`Cache hit for pronunciation assessment: ${cacheKey}`);
							return resolve(cachedResult);
						}

						// Đọc nội dung file âm thanh
						const audioContent = fs.readFileSync(audioFilePath);

						// Tạo audio config từ nội dung file âm thanh
						const audioConfig = sdk.AudioConfig.fromWavFileInput(audioContent, audioFilePath);

						// Cấu hình đánh giá phát âm với thang điểm 100
						const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
							referenceText,
							sdk.PronunciationAssessmentGradingSystem.HundredMark, // Thay đổi sang thang điểm 100
							sdk.PronunciationAssessmentGranularity.Phoneme, // Thay đổi sang mức độ phoneme để phân tích chi tiết hơn
							true // enableMiscue - bật tính năng phát hiện lỗi phát âm
						);

						// Cấu hình thêm cho đánh giá ngữ điệu và nhịp điệu
						pronunciationConfig.enableProsodyAssessment = true;

						// Tạo speech recognizer
						const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

						// Áp dụng cấu hình đánh giá phát âm
						pronunciationConfig.applyTo(recognizer);

						// Lưu thời gian bắt đầu để tính tốc độ nói
						const startTime = Date.now();

						// Xử lý kết quả đánh giá
						recognizer.recognizeOnceAsync(
							(result) => {
								// Tính toán thời gian xử lý để ước tính tốc độ nói
								const endTime = Date.now();
								const processingTimeMs = endTime - startTime;

								// Lấy kết quả đánh giá phát âm
								const pronunciationAssessmentResult = sdk.PronunciationAssessmentResult.fromResult(result);

								// Cấu trúc kết quả
								const assessmentResult = {
									pronunciationScore: pronunciationAssessmentResult.pronunciationScore,
									accuracyScore: pronunciationAssessmentResult.accuracyScore,
									fluencyScore: pronunciationAssessmentResult.fluencyScore,
									completenessScore: pronunciationAssessmentResult.completenessScore,
									prosodyScore: pronunciationAssessmentResult.prosodyScore || 0, // Điểm ngữ điệu
									transcription: result.text,
									words: [],
									phonemes: [],
									speechRate: {
										processingTimeMs,
										estimatedWordsPerMinute: this.calculateSpeechRate(result.text, processingTimeMs)
									}
								};

								// Xử lý chi tiết đánh giá từng từ
								if (pronunciationAssessmentResult.detailResult && pronunciationAssessmentResult.detailResult.words) {
									assessmentResult.words = pronunciationAssessmentResult.detailResult.words.map(word => ({
										word: word.word,
										accuracyScore: word.accuracyScore,
										errorType: word.errorType,
										pronunciationAssessment: {
											accuracyScore: word.pronunciationAssessment ? word.pronunciationAssessment.accuracyScore : null,
											stressScore: word.pronunciationAssessment ? word.pronunciationAssessment.stressScore : null // Điểm trọng âm
										},
										syllables: word.syllables ? word.syllables.map(s => ({
											syllable: s.syllable,
											pronunciationAssessment: s.pronunciationAssessment
										})) : [],
										phonemes: word.phonemes ? word.phonemes.map(p => ({
											phoneme: p.phoneme,
											pronunciationAssessment: p.pronunciationAssessment
										})) : []
									}));
								}

								// Xử lý chi tiết đánh giá phoneme
								if (pronunciationAssessmentResult.detailResult && pronunciationAssessmentResult.detailResult.phonemes) {
									assessmentResult.phonemes = pronunciationAssessmentResult.detailResult.phonemes.map(phoneme => ({
										phoneme: phoneme.phoneme,
										accuracyScore: phoneme.accuracyScore,
									}));
								}

								// Lưu kết quả vào cache
								resultCache.set(cacheKey, assessmentResult);

								resolve(assessmentResult);
								recognizer.close();
							},
							(err) => {
								reject(err);
								recognizer.close();
							}
						);
					} catch (error) {
						reject(error);
					}
				});
			}
		);
	}

	/**
	 * Tính tốc độ nói dựa trên văn bản và thời gian xử lý
	 * @param {string} text - Văn bản đã nhận dạng
	 * @param {number} processingTimeMs - Thời gian xử lý (ms)
	 * @returns {number} - Số từ trên phút
	 */
	calculateSpeechRate(text, processingTimeMs) {
		// Ước tính số từ trong văn bản tiếng Nhật
		const wordCount = text.length / 2; // Ước tính sơ bộ cho tiếng Nhật

		// Tính số từ trên phút
		const minutes = processingTimeMs / 60000;
		return Math.round(wordCount / minutes);
	}

	/**
	 * Phân tích trọng âm từ vựng 
	 * @param {string} audioFilePath - Đường dẫn tới file âm thanh
	 * @param {string} referenceText - Văn bản tham chiếu
	 * @returns {Promise<Object>} - Kết quả phân tích trọng âm
	 */
	async analyzeWordStress(audioFilePath, referenceText) {
		// Tạo cache key từ hash của file audio và reference text
		const audioHash = crypto.createHash('md5').update(fs.readFileSync(audioFilePath)).digest('hex');
		const cacheKey = `stress_${audioHash}_${referenceText}`;

		// Kiểm tra cache
		const cachedResult = resultCache.get(cacheKey);
		if (cachedResult) {
			console.log(`Cache hit for word stress analysis: ${cacheKey}`);
			return cachedResult;
		}

		// Sử dụng kết quả từ assessPronunciation nhưng tập trung vào trọng âm
		const result = await this.assessPronunciation(audioFilePath, referenceText);

		// Trích xuất thông tin trọng âm từ kết quả đánh giá
		const stressAnalysis = {
			overallStressScore: 0,
			wordStressDetails: []
		};

		// Tính điểm trọng âm trung bình và thu thập chi tiết
		let totalStressScore = 0;
		let wordCount = 0;

		result.words.forEach(word => {
			if (word.pronunciationAssessment && word.pronunciationAssessment.stressScore !== null) {
				totalStressScore += word.pronunciationAssessment.stressScore;
				wordCount++;

				stressAnalysis.wordStressDetails.push({
					word: word.word,
					stressScore: word.pronunciationAssessment.stressScore,
					isCorrectlyStressed: word.pronunciationAssessment.stressScore >= 80
				});
			}
		});

		stressAnalysis.overallStressScore = wordCount > 0 ? totalStressScore / wordCount : 0;

		// Lưu kết quả vào cache
		resultCache.set(cacheKey, stressAnalysis);

		return stressAnalysis;
	}

	/**
	 * Thiết lập cấu hình và trả về recognizer cho nhận dạng giọng nói thời gian thực
	 * @param {function} callback - Hàm callback để xử lý kết quả nhận dạng từng đoạn
	 * @returns {sdk.SpeechRecognizer} - Đối tượng recognizer đã được cấu hình
	 */
	setupRealTimeRecognizer(callback) {
		// Cấu hình tùy chọn cho nhận dạng thời gian thực
		const realTimeSpeechConfig = sdk.SpeechConfig.fromSubscription(
			config.azure.speech.key,
			config.azure.speech.region
		);
		realTimeSpeechConfig.speechRecognitionLanguage = 'ja-JP';

		// Sử dụng pushStream để nhận dữ liệu âm thanh trực tiếp
		const pushStream = sdk.AudioInputStream.createPushStream();
		const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

		// Tạo recognizer
		const recognizer = new sdk.SpeechRecognizer(realTimeSpeechConfig, audioConfig);

		// Thiết lập các sự kiện
		recognizer.recognized = (s, e) => {
			if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
				callback({
					type: 'recognized',
					text: e.result.text,
					offset: e.result.offset,
					duration: e.result.duration
				});
			}
		};

		recognizer.recognizing = (s, e) => {
			if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
				callback({
					type: 'recognizing',
					text: e.result.text,
					isFinal: false
				});
			}
		};

		recognizer.canceled = (s, e) => {
			callback({
				type: 'canceled',
				reason: e.reason,
				errorDetails: e.errorDetails
			});
		};

		recognizer.sessionStopped = (s, e) => {
			callback({
				type: 'stopped'
			});
		};

		// Trả về cả recognizer và pushStream để có thể gửi dữ liệu
		return { recognizer, pushStream };
	}

	/**
	 * Chuyển đổi văn bản thành giọng nói
	 * @param {string} text - Văn bản cần chuyển đổi thành giọng nói
	 * @param {string} outputFilePath - Đường dẫn file đầu ra
	 * @param {string} voiceName - Tên giọng đọc (mặc định: ja-JP-NanamiNeural)
	 * @returns {Promise<string>} - Đường dẫn đến file âm thanh đã tạo
	 */
	async textToSpeech(text, outputFilePath, voiceName = 'ja-JP-NanamiNeural') {
		// Tạo cache key từ text và voiceName
		const cacheKey = `tts_${crypto.createHash('md5').update(text + voiceName).digest('hex')}`;

		// Kiểm tra cache cho đường dẫn file
		const cachedFilePath = resultCache.get(cacheKey);
		if (cachedFilePath && fs.existsSync(cachedFilePath)) {
			console.log(`Cache hit for text-to-speech: ${cacheKey}`);
			// Copy file từ cache đến outputFilePath mới
			fs.copyFileSync(cachedFilePath, outputFilePath);
			return outputFilePath;
		}

		return retry(
			{ times: 3, interval: 1000, errorFilter: (err) => this._isRetryableError(err) },
			async () => {
				return new Promise((resolve, reject) => {
					try {
						// Tạo cấu hình cho text-to-speech
						const speechConfig = sdk.SpeechConfig.fromSubscription(
							config.azure.speech.key,
							config.azure.speech.region
						);

						// Thiết lập giọng đọc tiếng Nhật
						speechConfig.speechSynthesisVoiceName = voiceName;
						speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3;

						// Use file output to automatically create a proper MP3 container
						const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputFilePath);

						const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

						synthesizer.speakTextAsync(
							text,
							result => {
								if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
									// Lưu đường dẫn file vào cache
									resultCache.set(cacheKey, outputFilePath);
									resolve(outputFilePath);
								} else {
									reject(new Error(`Lỗi tổng hợp giọng nói: ${result.reason}`));
								}
								synthesizer.close();
							},
							error => {
								synthesizer.close();
								reject(error);
							}
						);
					} catch (error) {
						reject(error);
					}
				});
			}
		);
	}

	/**
	 * Nhận dạng ý định từ văn bản hoặc audio
	 * @param {string} textOrAudioPath - Văn bản hoặc đường dẫn file âm thanh
	 * @param {boolean} isAudio - Flag xác định đầu vào là âm thanh hay văn bản
	 * @returns {Promise<Object>} - Kết quả nhận dạng ý định
	 */
	async recognizeIntent(textOrAudioPath, isAudio = false) {
		// Nếu đầu vào là audio, trước tiên chuyển đổi thành văn bản
		let text = textOrAudioPath;
		if (isAudio) {
			text = await this.recognizeSpeech(textOrAudioPath);
		}

		// Giả lập phân tích ý định bằng cách phân tích cú pháp văn bản
		// Trong dự án thực tế, bạn sẽ sử dụng LUIS hoặc các dịch vụ NLU khác
		return this.analyzeIntentFromText(text);
	}

	/**
	 * Phân tích ý định từ văn bản (giả lập)
	 * @param {string} text - Văn bản cần phân tích
	 * @returns {Object} - Kết quả phân tích ý định
	 * @private
	 */
	analyzeIntentFromText(text) {
		// Các mẫu chuỗi đơn giản để nhận dạng ý định
		const intentPatterns = [
			{ intent: 'Greeting', patterns: ['こんにちは', 'おはよう', 'こんばんは', 'はじめまして'] },
			{ intent: 'Farewell', patterns: ['さようなら', 'じゃあね', 'また明日', 'お疲れ様'] },
			{ intent: 'Question', patterns: ['何', 'どこ', 'いつ', 'だれ', 'なぜ', 'どうして', 'か？', 'ですか'] },
			{ intent: 'Affirmation', patterns: ['はい', 'そうです', '分かりました', '了解'] },
			{ intent: 'Negation', patterns: ['いいえ', 'ちがいます', '違います', 'じゃない'] },
			{ intent: 'Request', patterns: ['ください', 'お願いします', '頂けますか', '欲しい'] },
			{ intent: 'Opinion', patterns: ['思います', '考えます', 'と思う', 'だと思う'] }
		];

		// Điểm số cho mỗi ý định
		const intentScores = {};

		// Tính điểm cho mỗi ý định dựa trên số lượng mẫu phù hợp
		intentPatterns.forEach(ip => {
			intentScores[ip.intent] = 0;
			ip.patterns.forEach(pattern => {
				if (text.includes(pattern)) {
					intentScores[ip.intent] += 1;
				}
			});
		});

		// Xác định ý định có điểm cao nhất
		let topIntent = 'None';
		let topScore = 0;

		for (const [intent, score] of Object.entries(intentScores)) {
			if (score > topScore) {
				topIntent = intent;
				topScore = score;
			}
		}

		// Nếu không tìm thấy ý định nào phù hợp, đặt là None
		if (topScore === 0) {
			topIntent = 'None';
		}

		// Trả về kết quả
		return {
			query: text,
			topIntent,
			intents: intentScores,
			entities: [], // Trong thực tế, bạn sẽ trích xuất các thực thể ở đây
			confidence: topScore > 0 ? Math.min(0.3 + (topScore * 0.1), 0.99) : 0.1
		};
	}

	/**
	 * Xác định xem lỗi có thể retry hay không
	 * @param {Error} error - Lỗi cần kiểm tra
	 * @returns {boolean} - true nếu lỗi có thể retry
	 * @private
	 */
	_isRetryableError(error) {
		// Các lỗi mạng, timeout, hoặc lỗi tạm thời từ Azure
		const retryableErrors = [
			'ETIMEDOUT',
			'ECONNRESET',
			'ECONNREFUSED',
			'EPIPE',
			'EHOSTUNREACH',
			'EAI_AGAIN',
			'ENOTFOUND',
			'socket hang up',
			'network error',
			'rate limit',
			'too many requests',
			'server busy',
			'timeout',
			'ConnectionError',
			'ServiceUnavailable'
		];

		if (!error) return false;

		const errorString = error.toString().toLowerCase();

		return retryableErrors.some(phrase =>
			errorString.includes(phrase.toLowerCase()) ||
			(error.code && error.code.includes(phrase))
		);
	}
}

module.exports = new SpeechService();