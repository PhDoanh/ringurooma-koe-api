/**
 * @file speechRoutes.js
 * @description Định tuyến API cho dịch vụ đánh giá phát âm tiếng Nhật
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const WebSocket = require('ws');
const http = require('http');
const os = require('os');

// Các dịch vụ
const speechService = require('../services/speechService');
const audioUtils = require('../utils/audioUtils');
const analysisService = require('../services/analysisService');

// Middleware
const apiAuth = require('../middleware/apiAuth');

// Cấu hình multer để xử lý upload file âm thanh
const storage = multer.memoryStorage();
const upload = multer({
	storage: storage,
	limits: { fileSize: 10 * 1024 * 1024 } // Giới hạn 10MB
});

/**
 * Xác định cấp độ JLPT dựa trên độ chính xác phát âm
 * @param {number} pronunciationScore - Điểm phát âm (0-100)
 * @returns {string} - Cấp độ JLPT (N1-N5)
 */
function determineJlptLevel(pronunciationScore) {
	if (pronunciationScore >= 90) return 'N1';
	if (pronunciationScore >= 80) return 'N2';
	if (pronunciationScore >= 70) return 'N3';
	if (pronunciationScore >= 60) return 'N4';
	return 'N5';
}

/**
 * Xử lý audio từ các nguồn khác nhau (file tải lên hoặc base64)
 * @param {Object} req - Express request object
 * @returns {Promise<{tempFilePath: string, cleanup: Function}>} - Đường dẫn tạm thời và hàm dọn dẹp
 */
async function processAudioInput(req) {
	let tempFilePath = null;
	let audioData = null;

	// Kiểm tra header để xác định kiểu dữ liệu audio
	const contentType = req.headers['content-type'] || '';
	const isBase64 = req.headers['x-audio-format'] === 'base64';

	if (isBase64 && req.body.audio_base64) {
		// Xử lý nếu đầu vào là chuỗi base64
		const base64Data = req.body.audio_base64;
		try {
			// Xóa phần prefix data:audio/xxx;base64, nếu có
			const base64Buffer = base64Data.replace(/^data:audio\/\w+;base64,/, '');
			audioData = Buffer.from(base64Buffer, 'base64');
			tempFilePath = await audioUtils.saveBufferToTempFile(audioData, '.wav');
		} catch (error) {
			throw new Error(`Lỗi khi xử lý dữ liệu base64: ${error.message}`);
		}
	} else if (req.file) {
		// Xử lý nếu đầu vào là file tải lên
		audioData = req.file.buffer;
		tempFilePath = await audioUtils.saveBufferToTempFile(audioData, '.wav');
	} else {
		throw new Error('Không tìm thấy dữ liệu âm thanh. Cung cấp file audio hoặc chuỗi base64.');
	}

	// Xác thực file âm thanh
	await audioUtils.validateAudioFile(tempFilePath);

	// Trả về đường dẫn tạm thời và hàm dọn dẹp
	return {
		tempFilePath,
		cleanup: () => {
			if (tempFilePath) {
				audioUtils.removeTempFile(tempFilePath);
			}
		}
	};
}

/**
 * Route POST /api/speech-to-text
 * Chuyển đổi âm thanh thành văn bản (transcribe)
 */
router.post('/speech-to-text', apiAuth, upload.single('audio'), async (req, res) => {
	let audioProcessor = null;

	try {
		// Xử lý đầu vào audio (file hoặc base64)
		audioProcessor = await processAudioInput(req);
		const tempFilePath = audioProcessor.tempFilePath;

		const userId = req.body.user_id || 'anonymous';

		console.log(`Xử lý nhận dạng giọng nói cho người dùng: ${userId}`);

		// Nhận dạng giọng nói
		const recognizedText = await speechService.recognizeSpeech(tempFilePath);

		// Tổng hợp kết quả
		const result = {
			user_id: userId,
			transcription: recognizedText,
			timestamp: new Date().toISOString()
		};

		// Phản hồi kết quả nhận dạng
		res.json(result);

	} catch (error) {
		console.error('Lỗi khi nhận dạng giọng nói:', error);
		res.status(500).json({
			error: `Lỗi khi xử lý nhận dạng giọng nói: ${error.message}`
		});
	} finally {
		// Xóa file tạm khi xử lý xong
		if (audioProcessor) {
			audioProcessor.cleanup();
		}
	}
});

/**
 * Route POST /api/pronunciation-assessment
 * Đánh giá phát âm tiếng Nhật dựa trên âm thanh và văn bản tham chiếu (nếu có)
 * Hỗ trợ cả chế độ Reading (có văn bản tham chiếu) và Speaking (không có văn bản tham chiếu)
 */
router.post('/pronunciation-assessment', apiAuth, upload.single('audio'), async (req, res) => {
	let audioProcessor = null;

	try {
		// Xử lý đầu vào audio (file hoặc base64)
		audioProcessor = await processAudioInput(req);
		const tempFilePath = audioProcessor.tempFilePath;

		const userId = req.body.user_id || 'anonymous';
		const referenceText = req.body.reference_text || "";

		// Xác định chế độ đánh giá dựa trên việc có văn bản tham chiếu hay không
		const isReadingMode = referenceText && referenceText.trim().length > 0;
		const mode = isReadingMode ? 'Reading' : 'Speaking';

		console.log(`Xử lý đánh giá phát âm cho người dùng: ${userId} (chế độ: ${mode})`);
		if (isReadingMode) {
			console.log(`Văn bản tham chiếu: ${referenceText}`);
		} else {
			console.log(`Không có văn bản tham chiếu, sử dụng chế độ ${mode}`);
		}

		// Xử lý song song
		const [pronunciationResult, recognizedText] = await Promise.all([
			speechService.assessPronunciation(tempFilePath, referenceText),
			speechService.recognizeSpeech(tempFilePath)
		]);

		// Chỉ phân tích trọng âm nếu có văn bản tham chiếu
		let stressAnalysis = null;
		if (isReadingMode) {
			stressAnalysis = await speechService.analyzeWordStress(tempFilePath, referenceText);
		} else {
			// Trong chế độ Speaking, tạo phân tích trọng âm từ kết quả pronunciation
			stressAnalysis = {
				overallStressScore: 0,
				wordStressDetails: []
			};

			// Tính điểm trọng âm trung bình từ các từ đã nhận dạng
			let totalStressScore = 0;
			let wordCount = 0;

			pronunciationResult.words.forEach(word => {
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
		}

		// Xác định cấp độ JLPT dựa trên điểm phát âm
		const jlptLevel = determineJlptLevel(pronunciationResult.pronunciationScore);

		// Phân tích điểm mạnh và điểm yếu
		const strengthsWeaknesses = analysisService.analyzeStrengthsWeaknesses(pronunciationResult);

		// Đánh giá tốc độ nói
		const speechRateAnalysis = analysisService.analyzeSpeechRate(
			pronunciationResult.speechRate.estimatedWordsPerMinute);

		// Tổng hợp kết quả
		const result = {
			user_id: userId,
			assessment_mode: mode,
			reference_text: isReadingMode ? referenceText : null,
			transcription: {
				text: recognizedText,
				fromAssessment: pronunciationResult.transcription
			},
			jlpt_level: jlptLevel,
			pronunciation_scores: {
				accuracy: pronunciationResult.accuracyScore,
				fluency: pronunciationResult.fluencyScore,
				completeness: pronunciationResult.completenessScore, // null trong chế độ Speaking
				pronunciation: pronunciationResult.pronunciationScore,
				prosody: pronunciationResult.prosodyScore // Điểm ngữ điệu
			},
			speech_rate: {
				words_per_minute: pronunciationResult.speechRate.estimatedWordsPerMinute,
				assessment: speechRateAnalysis
			},
			word_stress: {
				overall_score: stressAnalysis.overallStressScore,
				details: stressAnalysis.wordStressDetails
			},
			analysis: {
				strengths: strengthsWeaknesses.strengths,
				weaknesses: strengthsWeaknesses.weaknesses,
				improvement_suggestions: strengthsWeaknesses.improvementSuggestions
			},
			word_details: pronunciationResult.words,
			phoneme_details: pronunciationResult.phonemes,
			timestamp: new Date().toISOString()
		};

		// Tính toán chênh lệch với điểm chuẩn (chỉ áp dụng cho Reading mode)
		if (isReadingMode) {
			const benchmark = 80;
			result.benchmark_comparison = {
				accuracy_vs_benchmark: (pronunciationResult.accuracyScore - benchmark).toFixed(2),
				fluency_vs_benchmark: (pronunciationResult.fluencyScore - benchmark).toFixed(2),
				overall_vs_benchmark: ((pronunciationResult.pronunciationScore - benchmark)).toFixed(2)
			};
		}

		// Phản hồi kết quả đánh giá
		res.json(result);

	} catch (error) {
		console.error('Lỗi khi đánh giá phát âm:', error);
		res.status(500).json({
			error: `Lỗi khi xử lý đánh giá phát âm: ${error.message}`
		});
	} finally {
		// Xóa file tạm khi xử lý xong
		if (audioProcessor) {
			audioProcessor.cleanup();
		}
	}
});

/**
 * Route POST /api/text-to-speech
 * Chuyển đổi văn bản thành giọng nói
 */
router.post('/text-to-speech', apiAuth, express.json(), async (req, res) => {
	try {
		// Kiểm tra xem có văn bản đầu vào không
		if (!req.body.text) {
			return res.status(400).json({ error: 'Cần cung cấp văn bản đầu vào (text)' });
		}

		const text = req.body.text;
		const voiceName = req.body.voice_name || 'ja-JP-NanamiNeural';

		console.log(`Xử lý chuyển đổi văn bản thành giọng nói`);
		console.log(`Văn bản: ${text}`);
		console.log(`Giọng đọc: ${voiceName}`);

		// Tạo thư mục tạm thời nếu chưa tồn tại
		const tempDir = path.join(os.tmpdir(), 'ringurooma-speech');
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}

		// Tạo tên file ngẫu nhiên
		const outputFileName = `tts-${Date.now()}.mp3`;
		const outputFilePath = path.join(tempDir, outputFileName);

		// Chuyển đổi văn bản thành giọng nói
		await speechService.textToSpeech(text, outputFilePath, voiceName);

		// Đọc file âm thanh để trả về
		const audioContent = fs.readFileSync(outputFilePath);

		// Thiết lập header cho phản hồi
		res.setHeader('Content-Type', 'audio/mp3');
		res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);

		// Gửi file âm thanh
		res.send(audioContent);

		// Xóa file tạm
		fs.unlinkSync(outputFilePath);

	} catch (error) {
		console.error('Lỗi khi chuyển đổi văn bản thành giọng nói:', error);
		res.status(500).json({
			error: `Lỗi khi chuyển đổi văn bản thành giọng nói: ${error.message}`
		});
	}
});

/**
 * Route POST /api/intent-recognition
 * Nhận dạng ý định từ văn bản hoặc âm thanh
 */
router.post('/intent-recognition', apiAuth, upload.single('audio'), async (req, res) => {
	let audioProcessor = null;

	try {
		const userId = req.body.user_id || 'anonymous';
		let isAudio = false;
		let tempFilePath = null;

		// Xác định đầu vào là văn bản hay âm thanh
		if (req.file || (req.headers['x-audio-format'] === 'base64' && req.body.audio_base64)) {
		// Đầu vào là âm thanh (file hoặc base64)
			isAudio = true;
			audioProcessor = await processAudioInput(req);
			tempFilePath = audioProcessor.tempFilePath;
			console.log(`Xử lý nhận dạng ý định từ âm thanh cho người dùng: ${userId}`);
		} else if (req.body.text) {
			// Đầu vào là văn bản
			console.log(`Xử lý nhận dạng ý định từ văn bản cho người dùng: ${userId}`);
			console.log(`Văn bản: ${req.body.text}`);
		} else {
			return res.status(400).json({ error: 'Cần cung cấp âm thanh hoặc văn bản đầu vào (audio, audio_base64 hoặc text)' });
		}

		// Nhận dạng ý định
		const intentResult = await speechService.recognizeIntent(
			isAudio ? tempFilePath : req.body.text,
			isAudio
		);

		// Tổng hợp kết quả
		const result = {
			user_id: userId,
			query: intentResult.query,
			intent: {
				top: intentResult.topIntent,
				confidence: intentResult.confidence
			},
			intents: intentResult.intents,
			entities: intentResult.entities,
			timestamp: new Date().toISOString()
		};

		// Phản hồi kết quả nhận dạng ý định
		res.json(result);

	} catch (error) {
		console.error('Lỗi khi nhận dạng ý định:', error);
		res.status(500).json({
			error: `Lỗi khi nhận dạng ý định: ${error.message}`
		});
	} finally {
		// Xóa file tạm khi xử lý xong
		if (audioProcessor) {
			audioProcessor.cleanup();
		}
	}
});

/**
 * Cấu hình WebSocket cho nhận dạng giọng nói thời gian thực
 * @param {http.Server} server - Máy chủ HTTP
 */
function setupWebSocket(server) {
	const wss = new WebSocket.Server({
		server,
		// Thêm cấu hình WebSocket
		perMessageDeflate: true, // Bật nén dữ liệu
		maxPayload: 5 * 1024 * 1024 // Giới hạn kích thước tin nhắn 5MB
	});

	// Theo dõi số lượng kết nối
	let connectionCount = 0;

	wss.on('connection', (ws, req) => {
		// Giới hạn số lượng kết nối đồng thời
		connectionCount++;
		if (connectionCount > 100) {
			ws.close(1013, 'Quá nhiều kết nối đồng thời');
			return;
		}

		// Thiết lập timeout 5 phút cho mỗi kết nối
		const connectionTimeout = setTimeout(() => {
			ws.close(1000, 'Timeout');
		}, 5 * 60 * 1000);

		console.log('Client kết nối WebSocket cho nhận dạng giọng nói thời gian thực');
		console.log(`Số kết nối hiện tại: ${connectionCount}`);

		let recognizer = null;
		let pushStream = null;

		// Triển khai cơ chế ping/pong để phát hiện mất kết nối
		ws.isAlive = true;
		ws.on('pong', () => {
			ws.isAlive = true;
		});

		// Xử lý tin nhắn từ client
		ws.on('message', (message) => {
			try {
				// Kiểm tra xem tin nhắn có phải là văn bản JSON không
				if (typeof message === 'string' || message instanceof Buffer && message.toString().startsWith('{')) {
					const jsonMessage = JSON.parse(message.toString());

					// Xử lý lệnh từ client
					if (jsonMessage.command === 'start') {
						// Bắt đầu phiên nhận dạng giọng nói
						console.log('Bắt đầu phiên nhận dạng giọng nói thời gian thực');

						// Thiết lập recognizer và pushStream
						const result = speechService.setupRealTimeRecognizer((recognitionResult) => {
							ws.send(JSON.stringify({
								type: 'recognition',
								result: recognitionResult
							}));
						});

						recognizer = result.recognizer;
						pushStream = result.pushStream;

						// Bắt đầu nhận dạng liên tục
						recognizer.startContinuousRecognitionAsync(
							() => {
								ws.send(JSON.stringify({
									type: 'status',
									message: 'Đã bắt đầu nhận dạng giọng nói thời gian thực'
								}));
							},
							(err) => {
								ws.send(JSON.stringify({
									type: 'error',
									message: `Lỗi khi bắt đầu nhận dạng: ${err}`
								}));
							}
						);
					} else if (jsonMessage.command === 'stop') {
						// Dừng phiên nhận dạng giọng nói
						if (recognizer) {
							recognizer.stopContinuousRecognitionAsync(
								() => {
									ws.send(JSON.stringify({
										type: 'status',
										message: 'Đã dừng nhận dạng giọng nói thời gian thực'
									}));

									// Giải phóng tài nguyên
									recognizer.close();
									recognizer = null;
									pushStream = null;
								},
								(err) => {
									ws.send(JSON.stringify({
										type: 'error',
										message: `Lỗi khi dừng nhận dạng: ${err}`
									}));
								}
							);
						}
					}
				} else {
					// Tin nhắn là dữ liệu âm thanh
					if (pushStream) {
						try {
							// Gửi dữ liệu âm thanh đến pushStream
							pushStream.write(message);
						} catch (err) {
							console.error('Lỗi khi xử lý dữ liệu âm thanh:', err);
							ws.send(JSON.stringify({
								type: 'error',
								message: 'Lỗi khi xử lý dữ liệu âm thanh'
							}));
						}
					}
				}
			} catch (error) {
				console.error('Lỗi khi xử lý tin nhắn WebSocket:', error);
				ws.send(JSON.stringify({
					type: 'error',
					message: `Lỗi khi xử lý tin nhắn: ${error.message}`
				}));
			}
		});

		// Xử lý sự kiện đóng kết nối
		ws.on('close', () => {
			console.log('Client ngắt kết nối WebSocket');
			connectionCount--;
			clearTimeout(connectionTimeout);

			// Giải phóng tài nguyên
			if (recognizer) {
				recognizer.stopContinuousRecognitionAsync(() => {
					recognizer.close();
				}, (err) => {
					console.error('Lỗi khi dừng nhận dạng:', err);
				});
			}
		});

		// Xử lý sự kiện lỗi
		ws.on('error', (err) => {
			console.error('Lỗi WebSocket:', err);
			connectionCount--;
		});

		// Gửi thông báo kết nối thành công
		ws.send(JSON.stringify({
			type: 'status',
			message: 'Đã kết nối tới dịch vụ nhận dạng giọng nói thời gian thực'
		}));
	});

	// Kiểm tra kết nối còn sống định kỳ
	const interval = setInterval(() => {
		wss.clients.forEach((ws) => {
			if (ws.isAlive === false) return ws.terminate();
			ws.isAlive = false;
			ws.ping();
		});
	}, 30000);

	wss.on('close', () => {
		clearInterval(interval);
	});

	console.log('Đã thiết lập WebSocket cho nhận dạng giọng nói thời gian thực');
}

// Route để xử lý các yêu cầu xuống từ route gốc /evaluate-pronunciation để đảm bảo tương thích ngược
router.post('/evaluate-pronunciation', apiAuth, upload.single('audio'), async (req, res) => {
	let audioProcessor = null;

	try {
		// Kiểm tra xem có văn bản tham chiếu không
		if (!req.body.reference_text) {
			return res.status(400).json({ error: 'Cần cung cấp văn bản tham chiếu (reference_text)' });
		}

		// Xử lý đầu vào audio (file hoặc base64)
		audioProcessor = await processAudioInput(req);
		const tempFilePath = audioProcessor.tempFilePath;

		const userId = req.body.user_id || 'anonymous';
		const referenceText = req.body.reference_text;

		// Chuyển hướng đến API mới
		const result = await new Promise((resolve, reject) => {
			// Xử lý giống như /api/pronunciation-assessment
			Promise.all([
				speechService.assessPronunciation(tempFilePath, referenceText),
				speechService.recognizeSpeech(tempFilePath),
				speechService.analyzeWordStress(tempFilePath, referenceText)
			])
				.then(([pronunciationResult, recognizedText, stressAnalysis]) => {
					// Xác định cấp độ JLPT
					const jlptLevel = determineJlptLevel(pronunciationResult.pronunciationScore);

					// Phân tích điểm mạnh, điểm yếu
					const strengthsWeaknesses = analysisService.analyzeStrengthsWeaknesses(pronunciationResult);

					// Đánh giá tốc độ nói
					const speechRateAnalysis = analysisService.analyzeSpeechRate(
						pronunciationResult.speechRate.estimatedWordsPerMinute
					);

					// Tổng hợp kết quả
					const result = {
						user_id: userId,
						reference_text: referenceText,
						transcription: recognizedText,
						jlpt_level: jlptLevel,
						pronunciation_scores: {
							accuracy: pronunciationResult.accuracyScore,
							fluency: pronunciationResult.fluencyScore,
							completeness: pronunciationResult.completenessScore,
							pronunciation: pronunciationResult.pronunciationScore,
							prosody: pronunciationResult.prosodyScore
						},
						speech_rate: {
							words_per_minute: pronunciationResult.speechRate.estimatedWordsPerMinute,
							assessment: speechRateAnalysis
						},
						word_stress: {
							overall_score: stressAnalysis.overallStressScore,
							details: stressAnalysis.wordStressDetails
						},
						analysis: {
							strengths: strengthsWeaknesses.strengths,
							weaknesses: strengthsWeaknesses.weaknesses,
							improvement_suggestions: strengthsWeaknesses.improvementSuggestions
						},
						word_details: pronunciationResult.words,
						phoneme_details: pronunciationResult.phonemes,
						timestamp: new Date().toISOString()
					};

					// Tính toán chênh lệch với điểm chuẩn
					const benchmark = 80;
					result.benchmark_comparison = {
						accuracy_vs_benchmark: (pronunciationResult.accuracyScore - benchmark).toFixed(2),
						fluency_vs_benchmark: (pronunciationResult.fluencyScore - benchmark).toFixed(2),
						overall_vs_benchmark: ((pronunciationResult.pronunciationScore - benchmark)).toFixed(2)
					};

					resolve(result);
				})
				.catch(reject);
		});

		// Phản hồi kết quả
		res.json(result);

	} catch (error) {
		console.error('Lỗi khi đánh giá phát âm:', error);
		res.status(500).json({
			error: `Lỗi khi xử lý đánh giá phát âm: ${error.message}`
		});
	} finally {
		// Xóa file tạm khi xử lý xong
		if (audioProcessor) {
			audioProcessor.cleanup();
		}
	}
});

// Export setupWebSocket để sử dụng trong server.js
router.setupWebSocket = setupWebSocket;

module.exports = router;