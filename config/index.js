// Cấu hình môi trường cho dự án Ringurooma
const dotenv = require('dotenv');
const path = require('path');

// Đọc file .env
dotenv.config();

// Cấu hình chung cho ứng dụng
const config = {
	server: {
		port: process.env.PORT || 3000,
	},

	// Cấu hình Azure Speech Service
	azure: {
		speech: {
			key: process.env.SPEECH_KEY,
			region: process.env.SPEECH_REGION
		}
	}
};

// Kiểm tra các thông tin cấu hình bắt buộc
const validateConfig = () => {
	const requiredVars = [
		{ path: 'azure.speech.key', name: 'SPEECH_KEY' },
		{ path: 'azure.speech.region', name: 'SPEECH_REGION' }
	];

	let missingVars = [];

	requiredVars.forEach(variable => {
		// Phân tích đường dẫn để truy cập thuộc tính lồng nhau
		const props = variable.path.split('.');
		let value = config;

		for (const prop of props) {
			value = value[prop];
			if (value === undefined) break;
		}

		if (!value) {
			missingVars.push(variable.name);
		}
	});

	if (missingVars.length > 0) {
		console.error(`Thiếu các biến môi trường bắt buộc: ${missingVars.join(', ')}`);
		console.error('Vui lòng cập nhật file .env của bạn với các giá trị phù hợp');
		return false;
	}

	return true;
};

// Đối tượng config được xuất ra để sử dụng trong toàn ứng dụng
module.exports = {
	config,
	validateConfig
};