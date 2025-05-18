/**
 * @file audioUtils.js
 * @description Công cụ tiện ích xử lý tệp âm thanh
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');

// Chuyển các hàm callback sang Promise
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);

/**
 * Công cụ xử lý tệp âm thanh
 */
class AudioUtils {
	/**
	 * Lưu buffer âm thanh vào tệp tạm thời
	 * @param {Buffer} audioData - Dữ liệu âm thanh dạng Buffer
	 * @param {string} [extension='.wav'] - Phần mở rộng tệp
	 * @returns {Promise<string>} - Đường dẫn đến tệp tạm thời
	 */
	async saveBufferToTempFile(audioData, extension = '.wav') {
		try {
			// Tạo thư mục tạm thời nếu chưa tồn tại
			const tempDir = path.join(os.tmpdir(), 'ringurooma');
			await this.ensureDirectoryExists(tempDir);

			// Tạo tên tệp tạm thời
			const filename = `audio-${Date.now()}${extension}`;
			const tempFilePath = path.join(tempDir, filename);

			// Ghi dữ liệu vào tệp
			await writeFile(tempFilePath, audioData);

			return tempFilePath;
		} catch (error) {
			throw new Error(`Lỗi khi lưu tệp âm thanh tạm thời: ${error.message}`);
		}
	}

	/**
	 * Đảm bảo thư mục tồn tại, tạo mới nếu chưa tồn tại
	 * @param {string} directory - Đường dẫn thư mục
	 * @returns {Promise<void>}
	 */
	async ensureDirectoryExists(directory) {
		try {
			await stat(directory);
		} catch (error) {
			if (error.code === 'ENOENT') {
				await mkdir(directory, { recursive: true });
			} else {
				throw error;
			}
		}
	}

	/**
	 * Xác nhận tệp âm thanh hợp lệ
	 * @param {string} filePath - Đường dẫn tệp âm thanh
	 * @param {object} options - Tùy chọn xác nhận
	 * @param {number} [options.maxSizeMB=10] - Kích thước tối đa (MB)
	 * @param {string[]} [options.allowedExtensions=['.wav', '.mp3']] - Các phần mở rộng được phép
	 * @returns {Promise<object>} - Thông tin tệp âm thanh
	 */
	async validateAudioFile(filePath, options = {}) {
		const {
			maxSizeMB = 10,
			allowedExtensions = ['.wav', '.mp3']
		} = options;

		try {
			// Kiểm tra tệp tồn tại
			const stats = await stat(filePath);

			// Kiểm tra kích thước tệp
			const fileSizeInMB = stats.size / (1024 * 1024);
			if (fileSizeInMB > maxSizeMB) {
				throw new Error(`Kích thước tệp (${fileSizeInMB.toFixed(2)} MB) vượt quá giới hạn ${maxSizeMB} MB.`);
			}

			// Kiểm tra phần mở rộng
			const extension = path.extname(filePath).toLowerCase();
			if (!allowedExtensions.includes(extension)) {
				throw new Error(`Định dạng tệp ${extension} không được hỗ trợ. Các định dạng được hỗ trợ: ${allowedExtensions.join(', ')}.`);
			}

			// Trả về thông tin tệp
			return {
				path: filePath,
				extension,
				sizeInMB: fileSizeInMB,
				mimeType: this.getMimeTypeByExtension(extension)
			};
		} catch (error) {
			throw new Error(`Tệp âm thanh không hợp lệ: ${error.message}`);
		}
	}

	/**
	 * Lấy MIME type dựa trên phần mở rộng tệp
	 * @param {string} extension - Phần mở rộng tệp (.wav, .mp3, vv)
	 * @returns {string} - MIME type
	 */
	getMimeTypeByExtension(extension) {
		const mimeTypes = {
			'.wav': 'audio/wav',
			'.mp3': 'audio/mp3',
			'.ogg': 'audio/ogg',
			'.m4a': 'audio/m4a',
			'.aac': 'audio/aac',
			'.flac': 'audio/flac'
		};

		return mimeTypes[extension] || 'application/octet-stream';
	}

	/**
	 * Xóa tệp tạm thời
	 * @param {string} filePath - Đường dẫn tệp cần xóa
	 * @returns {Promise<void>}
	 */
	async removeTempFile(filePath) {
		try {
			await unlink(filePath);
		} catch (error) {
			console.error(`Lỗi khi xóa tệp tạm thời ${filePath}:`, error.message);
		}
	}
}

module.exports = new AudioUtils();