/**
 * @file audioUtils.js
 * @description Tiện ích xử lý file âm thanh cho dịch vụ đánh giá phát âm
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Lưu buffer âm thanh vào file tạm thời
 * @param {Buffer} buffer - Buffer dữ liệu âm thanh
 * @param {string} extension - Phần mở rộng file (mặc định: .wav)
 * @returns {Promise<string>} - Đường dẫn đến file tạm
 */
async function saveBufferToTempFile(buffer, extension = '.wav') {
	// Tạo thư mục tạm thời nếu chưa tồn tại
	const tempDir = path.join(os.tmpdir(), 'ringurooma-speech');
	if (!fs.existsSync(tempDir)) {
		fs.mkdirSync(tempDir, { recursive: true });
	}

	// Tạo tên file ngẫu nhiên
	const randomName = crypto.randomBytes(16).toString('hex');
	const tempFilePath = path.join(tempDir, `${randomName}${extension}`);

	// Ghi buffer vào file
	return new Promise((resolve, reject) => {
		fs.writeFile(tempFilePath, buffer, (err) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(tempFilePath);
		});
	});
}

/**
 * Xóa file tạm thời
 * @param {string} filePath - Đường dẫn đến file cần xóa
 */
function removeTempFile(filePath) {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			console.log(`Đã xóa file tạm: ${filePath}`);
		}
	} catch (error) {
		console.error(`Lỗi khi xóa file tạm ${filePath}:`, error);
	}
}

/**
 * Xác thực file âm thanh
 * @param {string} filePath - Đường dẫn đến file âm thanh
 * @returns {Promise<void>}
 */
async function validateAudioFile(filePath) {
	return new Promise((resolve, reject) => {
		// Kiểm tra xem file có tồn tại không
		if (!fs.existsSync(filePath)) {
			return reject(new Error(`Không tìm thấy file: ${filePath}`));
		}

		// Kiểm tra kích thước file
		const stats = fs.statSync(filePath);
		const fileSizeInBytes = stats.size;
		const fileSizeInMB = fileSizeInBytes / (1024 * 1024);

		if (fileSizeInBytes === 0) {
			return reject(new Error('File âm thanh rỗng'));
		}

		if (fileSizeInMB > 10) {
			return reject(new Error(`File âm thanh quá lớn: ${fileSizeInMB.toFixed(2)}MB (giới hạn 10MB)`));
		}

		// Kiểm tra header của file WAV đơn giản
		// Đọc 12 byte đầu tiên để kiểm tra signature WAV
		const headerBuffer = Buffer.alloc(12);
		const fd = fs.openSync(filePath, 'r');
		fs.readSync(fd, headerBuffer, 0, 12, 0);
		fs.closeSync(fd);

		// Kiểm tra WAV header: "RIFF" + 4 bytes size + "WAVE"
		const isWav = headerBuffer.slice(0, 4).toString() === 'RIFF' &&
			headerBuffer.slice(8, 12).toString() === 'WAVE';

		if (!isWav && path.extname(filePath).toLowerCase() === '.wav') {
			return reject(new Error('File không phải là định dạng WAV hợp lệ'));
		}

		resolve();
	});
}

/**
 * Dọn dẹp các file tạm thời cũ
 * Xóa các file cũ hơn 30 phút
 */
function cleanupTempFiles() {
	const tempDir = path.join(os.tmpdir(), 'ringurooma-speech');
	if (fs.existsSync(tempDir)) {
		try {
			const files = fs.readdirSync(tempDir);
			const now = Date.now();
			let cleanedCount = 0;

			for (const file of files) {
				const filePath = path.join(tempDir, file);
				const stats = fs.statSync(filePath);
				// Xóa file cũ hơn 30 phút
				if (now - stats.mtimeMs > 30 * 60 * 1000) {
					fs.unlinkSync(filePath);
					cleanedCount++;
				}
			}

			if (cleanedCount > 0) {
				console.log(`Đã dọn dẹp ${cleanedCount} file tạm thời cũ`);
			}
		} catch (error) {
			console.error('Lỗi khi dọn dẹp file tạm:', error);
		}
	}
}

// Thiết lập cronjob để dọn dẹp file tạm mỗi 15 phút
setInterval(cleanupTempFiles, 15 * 60 * 1000);
// Chạy lần đầu khi khởi động server
cleanupTempFiles();

module.exports = {
	saveBufferToTempFile,
	removeTempFile,
	validateAudioFile,
	cleanupTempFiles
};