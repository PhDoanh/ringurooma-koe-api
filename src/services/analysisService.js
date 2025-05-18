/**
 * @file analysisService.js
 * @description Dịch vụ phân tích điểm mạnh, điểm yếu và đưa ra gợi ý cải thiện
 */

/**
 * Dịch vụ phân tích kết quả đánh giá phát âm
 */
class AnalysisService {
	/**
	 * Phân tích điểm mạnh, điểm yếu và đưa ra gợi ý cải thiện
	 * @param {Object} pronunciationResult - Kết quả đánh giá phát âm
	 * @returns {Object} - Phân tích điểm mạnh, điểm yếu và gợi ý
	 */
	analyzeStrengthsWeaknesses(pronunciationResult) {
		const strengths = [];
		const weaknesses = [];
		const improvementSuggestions = [];

		// Phân tích độ chính xác phát âm
		if (pronunciationResult.accuracyScore >= 80) {
			strengths.push("Phát âm chính xác các từ vựng");
		} else if (pronunciationResult.accuracyScore < 60) {
			weaknesses.push("Độ chính xác phát âm thấp");
			improvementSuggestions.push("Tập trung luyện phát âm từng từ riêng lẻ trước khi nói cả câu");
		}

		// Phân tích tính trôi chảy
		if (pronunciationResult.fluencyScore >= 80) {
			strengths.push("Nói trôi chảy, ít ngắt quãng");
		} else if (pronunciationResult.fluencyScore < 60) {
			weaknesses.push("Nói chưa trôi chảy, có nhiều ngắt quãng");
			improvementSuggestions.push("Luyện tập nói liên tục không ngắt quãng, tập đọc to các câu dài");
		}

		// Phân tích tính đầy đủ
		if (pronunciationResult.completenessScore >= 80) {
			strengths.push("Nói đầy đủ nội dung so với văn bản tham chiếu");
		} else if (pronunciationResult.completenessScore < 60) {
			weaknesses.push("Chưa nói đầy đủ nội dung so với văn bản tham chiếu");
			improvementSuggestions.push("Tập đọc và ghi nhớ toàn bộ văn bản trước khi nói");
		}

		// Phân tích ngữ điệu 
		if (pronunciationResult.prosodyScore >= 80) {
			strengths.push("Ngữ điệu tự nhiên, giống với người bản xứ");
		} else if (pronunciationResult.prosodyScore < 60) {
			weaknesses.push("Ngữ điệu chưa tự nhiên, còn đơn điệu");
			improvementSuggestions.push("Nghe và bắt chước ngữ điệu của người bản xứ, tập trung vào cao độ và trọng âm");
		}

		// Phân tích các từ có vấn đề
		const problematicWords = pronunciationResult.words.filter(word => word.accuracyScore < 60);
		if (problematicWords.length > 0) {
			const wordList = problematicWords.map(word => word.word).join(', ');
			weaknesses.push(`Có khó khăn khi phát âm các từ: ${wordList}`);
			improvementSuggestions.push("Tập trung luyện phát âm các từ khó này với sự hỗ trợ của từ điển phát âm");
		}

		return {
			strengths,
			weaknesses,
			improvementSuggestions
		};
	}

	/**
	 * Phân tích tốc độ nói
	 * @param {number} wordsPerMinute - Số từ trên phút
	 * @returns {Object} - Đánh giá tốc độ nói
	 */
	analyzeSpeechRate(wordsPerMinute) {
		// Tiếng Nhật, tốc độ nói lý tưởng khoảng 350-400 mora/phút (tương đương khoảng 100-150 từ/phút)
		const assessment = {
			rating: "",
			feedback: ""
		};

		if (wordsPerMinute < 80) {
			assessment.rating = "slow";
			assessment.feedback = "Tốc độ nói hơi chậm. Nói chậm có thể giúp phát âm rõ ràng, nhưng cần tăng tốc để đạt tốc độ tự nhiên.";
		} else if (wordsPerMinute >= 80 && wordsPerMinute <= 150) {
			assessment.rating = "good";
			assessment.feedback = "Tốc độ nói phù hợp, gần với tốc độ nói tự nhiên của người bản xứ.";
		} else {
			assessment.rating = "fast";
			assessment.feedback = "Tốc độ nói hơi nhanh. Nói nhanh có thể ảnh hưởng đến độ rõ ràng, hãy giảm tốc để phát âm rõ hơn.";
		}

		return assessment;
	}
}

module.exports = new AnalysisService();
