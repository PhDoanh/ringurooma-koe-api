/**
 * @file apiAuth.js
 * @description Middleware xác thực API key
 */

const { config } = require('../../config');

/**
 * Middleware xác thực API key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function apiAuth(req, res, next) {
	const apiKey = req.headers['x-api-key'] || req.query.api_key;

	// Kiểm tra nếu API key được cung cấp và khớp với cấu hình
	if (!apiKey || apiKey !== process.env.API_KEY) {
		return res.status(401).json({
			error: 'Unauthorized. Invalid or missing API key.'
		});
	}

	next();
}

module.exports = apiAuth;