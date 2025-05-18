/**
 * @file server.js
 * @description Máy chủ Express chính cho dịch vụ đánh giá phát âm tiếng Nhật
 */

const express = require('express');
const path = require('path');
const http = require('http');
const { config, validateConfig } = require('./config');

// Kiểm tra cấu hình
if (!validateConfig()) {
	console.error('Cấu hình không hợp lệ. Ứng dụng sẽ dừng lại.');
	process.exit(1);
}

// Khởi tạo ứng dụng Express
const app = express();
const PORT = config.server.port;

// Tạo HTTP server từ Express app (cần thiết cho WebSocket)
const server = http.createServer(app);

// Middleware cơ bản
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cho phép CORS
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
	res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

	if (req.method === 'OPTIONS') {
		return res.sendStatus(200);
	}

	next();
});

// Route mặc định
app.get('/', (req, res) => {
	res.json({
		message: 'Ringurooma Speech API Server',
		version: '1.0.0',
		status: 'running',
		features: [
			'Speech to Text (POST /api/speech-to-text)',
			'Real-time Speech to Text (WebSocket)',
			'Pronunciation Assessment (POST /api/pronunciation-assessment)',
			'Text to Speech (POST /api/text-to-speech)',
			'Intent Recognition (POST /api/intent-recognition)'
		]
	});
});

// Nhập các routes
const speechRoutes = require('./src/routes/speechRoutes');

// Sử dụng routes
app.use('/api', speechRoutes);

// Thiết lập WebSocket cho nhận dạng giọng nói thời gian thực
speechRoutes.setupWebSocket(server);

// Xử lý lỗi 404
app.use((req, res) => {
	res.status(404).json({ error: 'Không tìm thấy đường dẫn yêu cầu' });
});

// Xử lý lỗi
app.use((err, req, res, next) => {
	console.error('Lỗi máy chủ:', err);
	res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
});

// Khởi động máy chủ HTTP (không phải app Express)
server.listen(PORT, () => {
	console.log(`Ringurooma Speech API đang chạy trên cổng ${PORT}`);
	console.log(`Máy chủ được khởi động vào ${new Date().toLocaleString()}`);
	console.log(`Môi trường: ${process.env.NODE_ENV || 'development'}`);
	console.log('Các routes API đã sẵn sàng:');
	console.log('- GET  /                            : Kiểm tra trạng thái máy chủ');
	console.log('- POST /api/speech-to-text          : Chuyển đổi âm thanh thành văn bản');
	console.log('- POST /api/pronunciation-assessment: Đánh giá phát âm tiếng Nhật');
	console.log('- POST /api/text-to-speech          : Chuyển đổi văn bản thành giọng nói');
	console.log('- POST /api/intent-recognition      : Nhận dạng ý định từ văn bản/âm thanh');
	console.log('- WS   /                            : WebSocket cho nhận dạng giọng nói thời gian thực');
});