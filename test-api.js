/**
 * @file test-api.js
 * @description Script kiểm thử đơn giản cho Speech API
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const WebSocket = require('ws');
require('dotenv').config();

// Đường dẫn đến file âm thanh mẫu
const audioFilePath = path.join(__dirname, 'resources', 'audio', 'n5level.wav');

// Cấu hình API
const API_URL = 'http://localhost:3000'; // Thay đổi URL nếu cần
const API_KEY = process.env.API_KEY;

// Văn bản tham chiếu mẫu
const referenceText = 'こんにちは、私の名前は田中です。日本語を勉強しています。発音を評価してください。';

/**
 * Hiển thị menu chọn chức năng kiểm thử
 */
function showMenu() {
	console.log('\n=== RINGUROOMA SPEECH API TEST MENU ===');
	console.log('1. Kiểm thử chuyển đổi âm thanh thành văn bản (Speech to Text)');
	console.log('2. Kiểm thử đánh giá phát âm (Pronunciation Assessment)');
	console.log('3. Kiểm thử chuyển đổi văn bản thành giọng nói (Text to Speech)');
	console.log('4. Kiểm thử nhận dạng ý định (Intent Recognition)');
	console.log('5. Kiểm thử nhận dạng giọng nói thời gian thực (Real-time STT)');
	console.log('6. Kiểm thử tất cả API');
	console.log('7. Kiểm thử đánh giá phát âm với đầu vào Base64');
	console.log('8. Kiểm thử đánh giá phát âm ở chế độ Speaking (nói tự do)');
	console.log('0. Thoát');
	console.log('=======================================');
}

/**
 * Kiểm thử API chuyển đổi âm thanh thành văn bản
 */
async function testSpeechToText() {
	try {
		console.log('\nBắt đầu kiểm thử API chuyển đổi âm thanh thành văn bản...');

		// Tạo form data
		const formData = new FormData();
		formData.append('audio', fs.createReadStream(audioFilePath));
		formData.append('user_id', 'test-user-001');

		console.log(`Gửi file: ${audioFilePath}`);

		// Gửi request
		const response = await axios.post(`${API_URL}/api/speech-to-text`, formData, {
			headers: {
				...formData.getHeaders(),
				'X-API-Key': API_KEY
			}
		});

		// In kết quả
		console.log('\nAPI chuyển đổi âm thanh thành văn bản hoạt động thành công!');
		console.log('\nKết quả:');
		console.log(JSON.stringify(response.data, null, 2));
		return response.data;

	} catch (error) {
		handleApiError(error, 'chuyển đổi âm thanh thành văn bản');
		return null;
	}
}

/**
 * Kiểm thử API đánh giá phát âm
 */
async function testPronunciationAssessment() {
	try {
		console.log('\nBắt đầu kiểm thử API đánh giá phát âm...');

		// Tạo form data
		const formData = new FormData();
		formData.append('audio', fs.createReadStream(audioFilePath));
		formData.append('reference_text', referenceText);
		formData.append('user_id', 'test-user-001');

		console.log(`Gửi file: ${audioFilePath}`);
		console.log(`Văn bản tham chiếu: ${referenceText}`);

		// Gửi request
		const response = await axios.post(`${API_URL}/api/pronunciation-assessment`, formData, {
			headers: {
				...formData.getHeaders(),
				'X-API-Key': API_KEY
			}
		});

		// In kết quả
		console.log('\nAPI đánh giá phát âm hoạt động thành công!');
		console.log('\nKết quả:');
		console.log(JSON.stringify(response.data, null, 2));
		return response.data;

	} catch (error) {
		handleApiError(error, 'đánh giá phát âm');
		return null;
	}
}

/**
 * Kiểm thử API đánh giá phát âm với đầu vào base64
 */
async function testPronunciationAssessmentWithBase64() {
	try {
		console.log('\nBắt đầu kiểm thử API đánh giá phát âm với đầu vào base64...');

		// Đọc file âm thanh và chuyển thành base64
		const audioBuffer = fs.readFileSync(audioFilePath);
		const base64Audio = audioBuffer.toString('base64');

		console.log(`Đọc file: ${audioFilePath}`);
		console.log(`Văn bản tham chiếu: ${referenceText}`);
		console.log(`Kích thước chuỗi base64: ${base64Audio.length} ký tự`);

		// Dữ liệu request
		const requestData = {
			audio_base64: base64Audio,
			reference_text: referenceText,
			user_id: 'test-user-001'
		};

		// Gửi request
		const response = await axios.post(`${API_URL}/api/pronunciation-assessment`, requestData, {
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': API_KEY,
				'X-Audio-Format': 'base64'
			}
		});

		// In kết quả
		console.log('\nAPI đánh giá phát âm với đầu vào base64 hoạt động thành công!');
		console.log('\nKết quả:');
		console.log(JSON.stringify(response.data, null, 2));
		return response.data;

	} catch (error) {
		handleApiError(error, 'đánh giá phát âm với đầu vào base64');
		return null;
	}
}

/**
 * Kiểm thử API chuyển đổi văn bản thành giọng nói
 */
async function testTextToSpeech() {
	try {
		console.log('\nBắt đầu kiểm thử API chuyển đổi văn bản thành giọng nói...');

		// Dữ liệu gửi đi
		const requestData = {
			text: referenceText,
			voice_name: 'ja-JP-NanamiNeural'
		};

		console.log(`Văn bản: ${requestData.text}`);
		console.log(`Giọng đọc: ${requestData.voice_name}`);

		// Gửi request
		const response = await axios.post(`${API_URL}/api/text-to-speech`, requestData, {
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': API_KEY
			},
			responseType: 'arraybuffer' // Quan trọng: nhận dữ liệu dạng binary
		});

		// Lưu file âm thanh
		const outputPath = path.join(__dirname, 'test-output.mp3');
		fs.writeFileSync(outputPath, response.data);

		// In kết quả
		console.log('\nAPI chuyển đổi văn bản thành giọng nói hoạt động thành công!');
		console.log(`\nĐã lưu file âm thanh tại: ${outputPath}`);
		return true;

	} catch (error) {
		handleApiError(error, 'chuyển đổi văn bản thành giọng nói');
		return null;
	}
}

/**
 * Kiểm thử API nhận dạng ý định từ văn bản
 */
async function testIntentRecognition() {
	try {
		console.log('\nBắt đầu kiểm thử API nhận dạng ý định...');

		// Kiểm thử với đầu vào là văn bản
		console.log('Kiểm thử nhận dạng ý định từ văn bản...');

		// Dữ liệu gửi đi
		const requestData = {
			text: 'こんにちは、初めまして。お願いします。',
			user_id: 'test-user-001'
		};

		console.log(`Văn bản: ${requestData.text}`);

		// Gửi request
		const response = await axios.post(`${API_URL}/api/intent-recognition`, requestData, {
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': API_KEY
			}
		});

		// In kết quả
		console.log('\nAPI nhận dạng ý định từ văn bản hoạt động thành công!');
		console.log('\nKết quả:');
		console.log(JSON.stringify(response.data, null, 2));

		// Kiểm thử với đầu vào là âm thanh
		console.log('\nKiểm thử nhận dạng ý định từ âm thanh...');

		// Tạo form data
		const formData = new FormData();
		formData.append('audio', fs.createReadStream(audioFilePath));
		formData.append('user_id', 'test-user-001');

		console.log(`Gửi file: ${audioFilePath}`);

		// Gửi request
		const audioResponse = await axios.post(`${API_URL}/api/intent-recognition`, formData, {
			headers: {
				...formData.getHeaders(),
				'X-API-Key': API_KEY
			}
		});

		// In kết quả
		console.log('\nAPI nhận dạng ý định từ âm thanh hoạt động thành công!');
		console.log('\nKết quả:');
		console.log(JSON.stringify(audioResponse.data, null, 2));

		return {
			textResult: response.data,
			audioResult: audioResponse.data
		};

	} catch (error) {
		handleApiError(error, 'nhận dạng ý định');
		return null;
	}
}

/**
 * Kiểm thử WebSocket cho nhận dạng giọng nói thời gian thực
 * Lưu ý: Đây chỉ là demo đơn giản, trong thực tế bạn sẽ gửi dữ liệu âm thanh theo thời gian thực
 */
async function testRealTimeSTT() {
	return new Promise((resolve) => {
		console.log('\nBắt đầu kiểm thử WebSocket cho nhận dạng giọng nói thời gian thực...');

		// Kết nối đến WebSocket server
		const ws = new WebSocket(`ws://${API_URL.replace(/^https?:\/\//, '')}`);

		ws.on('open', () => {
			console.log('Đã kết nối đến WebSocket server');

			// Đọc file âm thanh mẫu
			const audioData = fs.readFileSync(audioFilePath);

			// Gửi lệnh bắt đầu nhận dạng
			ws.send(JSON.stringify({ command: 'start' }));

			// Đợi 1 giây trước khi gửi dữ liệu âm thanh
			setTimeout(() => {
				console.log('Gửi dữ liệu âm thanh...');

				// Giả lập gửi từng chunk dữ liệu âm thanh
				// Trong thực tế, bạn sẽ chia nhỏ dữ liệu và gửi theo thời gian thực
				const chunkSize = 4096;
				for (let i = 0; i < audioData.length; i += chunkSize) {
					const chunk = audioData.slice(i, i + chunkSize);
					ws.send(chunk);
				}

				// Đợi 3 giây để nhận kết quả rồi dừng kết nối
				setTimeout(() => {
					ws.send(JSON.stringify({ command: 'stop' }));
					setTimeout(() => {
						ws.close();
						resolve(true);
					}, 1000);
				}, 3000);
			}, 1000);
		});

		ws.on('message', (data) => {
			try {
				const message = JSON.parse(data);
				console.log(`Nhận tin nhắn: ${JSON.stringify(message, null, 2)}`);
			} catch (error) {
				console.log('Nhận dữ liệu không phải JSON:', data);
			}
		});

		ws.on('error', (error) => {
			console.error('Lỗi WebSocket:', error);
			resolve(false);
		});

		ws.on('close', () => {
			console.log('Kết nối WebSocket đã đóng');
		});
	});
}

/**
 * Xử lý lỗi khi gọi API
 * @param {Error} error - Lỗi
 * @param {string} apiName - Tên API
 */
function handleApiError(error, apiName) {
	console.error(`\nLỗi khi kiểm thử API ${apiName}:`);
	if (error.response) {
		console.error(`Status: ${error.response.status}`);
		console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
	} else {
		console.error(error.message);
	}
}

/**
 * Chạy kiểm thử tất cả API
 */
async function testAllApis() {
	console.log('\nBắt đầu kiểm thử tất cả API...');

	// Kiểm thử lần lượt từng API
	await testSpeechToText();
	await testPronunciationAssessment();
	await testPronunciationAssessmentWithBase64();
	await testTextToSpeech();
	await testIntentRecognition();
	await testRealTimeSTT();

	console.log('\nĐã hoàn thành kiểm thử tất cả API!');
}

/**
 * Kiểm thử API đánh giá phát âm ở chế độ Speaking (không cần văn bản tham chiếu)
 */
async function testSpeakingModePronunciation() {
	try {
		console.log('\nBắt đầu kiểm thử API đánh giá phát âm ở chế độ Speaking (nói tự do)...');

		// Tạo form data
		const formData = new FormData();
		formData.append('audio', fs.createReadStream(audioFilePath));
		formData.append('user_id', 'test-user-001');
		// Không cung cấp reference_text để kích hoạt chế độ Speaking

		console.log(`Gửi file: ${audioFilePath}`);
		console.log('Chế độ: Speaking (không có văn bản tham chiếu)');

		// Gửi request
		const response = await axios.post(`${API_URL}/api/pronunciation-assessment`, formData, {
			headers: {
				...formData.getHeaders(),
				'X-API-Key': API_KEY
			}
		});

		// In kết quả
		console.log('\nAPI đánh giá phát âm ở chế độ Speaking hoạt động thành công!');
		console.log('\nKết quả:');
		console.log(JSON.stringify(response.data, null, 2));
		return response.data;

	} catch (error) {
		handleApiError(error, 'đánh giá phát âm ở chế độ Speaking');
		return null;
	}
}

/**
 * Xử lý lựa chọn từ người dùng
 * @param {string} choice - Lựa chọn
 */
async function handleChoice(choice) {
	switch (choice) {
		case '1':
			await testSpeechToText();
			break;
		case '2':
			await testPronunciationAssessment();
			break;
		case '3':
			await testTextToSpeech();
			break;
		case '4':
			await testIntentRecognition();
			break;
		case '5':
			await testRealTimeSTT();
			break;
		case '6':
			await testAllApis();
			break;
		case '7':
			await testPronunciationAssessmentWithBase64();
			break;
		case '8':
			await testSpeakingModePronunciation();
			break;
		case '0':
			console.log('Thoát chương trình...');
			process.exit(0);
		default:
			console.log('Lựa chọn không hợp lệ!');
	}

	// Hiển thị menu và tiếp tục
	showMenu();
	process.stdout.write('Nhập lựa chọn của bạn: ');
}

/**
 * Hàm main
 */
async function main() {
	console.log('=== RINGUROOMA SPEECH API TEST ===');

	// Kiểm tra xem có API_KEY trong biến môi trường không
	if (!API_KEY) {
		console.error('Lỗi: Thiếu API_KEY. Vui lòng cung cấp API_KEY trong file .env');
		process.exit(1);
	}

	// Kiểm tra xem file âm thanh mẫu có tồn tại không
	if (!fs.existsSync(audioFilePath)) {
		console.error(`Lỗi: Không tìm thấy file âm thanh mẫu tại đường dẫn: ${audioFilePath}`);
		process.exit(1);
	}

	// Kiểm thử tất cả API
	if (process.argv.includes('--all')) {
		await testAllApis();
		process.exit(0);
	}

	// Kiểm tra xem có tham số dòng lệnh cho API cụ thể không
	if (process.argv.includes('--stt')) {
		await testSpeechToText();
		process.exit(0);
	}

	if (process.argv.includes('--pronunciation')) {
		await testPronunciationAssessment();
		process.exit(0);
	}

	if (process.argv.includes('--pronunciation-base64')) {
		await testPronunciationAssessmentWithBase64();
		process.exit(0);
	}

	if (process.argv.includes('--tts')) {
		await testTextToSpeech();
		process.exit(0);
	}

	if (process.argv.includes('--intent')) {
		await testIntentRecognition();
		process.exit(0);
	}

	if (process.argv.includes('--realtime')) {
		await testRealTimeSTT();
		process.exit(0);
	}

	if (process.argv.includes('--speaking')) {
		await testSpeakingModePronunciation();
		process.exit(0);
	}

	// Hiển thị menu tương tác
	showMenu();

	// Lắng nghe input từ người dùng
	process.stdin.setEncoding('utf8');
	process.stdout.write('Nhập lựa chọn của bạn: ');

	process.stdin.on('data', (data) => {
		const choice = data.trim();
		handleChoice(choice);
	});
}

// Chạy chương trình
main().catch(error => {
	console.error('Lỗi không mong muốn:', error);
	process.exit(1);
});