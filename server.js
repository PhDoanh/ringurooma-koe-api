/**
 * @file server.js
 * @description Máy chủ Express chính cho dịch vụ đánh giá phát âm tiếng Nhật
 */

const express = require('express');
const path = require('path');
const http = require('http');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
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
app.use(compression()); // Thêm nén dữ liệu để giảm băng thông
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Middleware theo dõi thời gian xử lý request
app.use((req, res, next) => {
	req.startTime = Date.now();

	// Lưu thời gian xử lý khi response hoàn tất
	res.on('finish', () => {
		const processingTime = Date.now() - req.startTime;
		console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${processingTime}ms`);
	});

	next();
});

// Cấu hình Rate Limiting
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 phút
	max: 100, // Giới hạn mỗi IP 100 request/15 phút
	standardHeaders: true, // Trả về thông tin RateLimit trong header (X-RateLimit-*)
	legacyHeaders: false, // Disable header `X-RateLimit-*`
	message: { error: 'Quá nhiều request từ IP này, vui lòng thử lại sau' },
	skip: (req) => {
		// Bỏ qua giới hạn cho các IP nội bộ (ví dụ: 127.0.0.1)
		const ip = req.ip || req.connection.remoteAddress;
		return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.');
	}
});

// Áp dụng giới hạn tần suất cho tất cả API
app.use('/api/', apiLimiter);

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

// Thêm các security headers
app.use((req, res, next) => {
	res.header('X-Content-Type-Options', 'nosniff');
	res.header('X-Frame-Options', 'DENY');
	res.header('X-XSS-Protection', '1; mode=block');
	res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
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