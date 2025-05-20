# Ringurooma Speech Service

Ringurooma Speech Service là một dịch vụ microservice xử lý và đánh giá kỹ năng nói tiếng Nhật, sử dụng Azure Speech Service SDK.

## Tính năng

- **Chuyển đổi giọng nói thành văn bản**: Nhận dạng và chuyển đổi giọng nói tiếng Nhật thành văn bản
- **Đánh giá phát âm**: Đánh giá độ chính xác phát âm tiếng Nhật theo thang điểm 100
- **Phân tích ngữ điệu và âm điệu**: Đánh giá độ tự nhiên của ngữ điệu khi nói tiếng Nhật
- **Đánh giá tốc độ nói**: Phân tích và đánh giá tốc độ nói có phù hợp hay không
- **Phân tích trọng âm từ vựng**: Đánh giá việc đặt trọng âm đúng vị trí trong từ
- **Phân tích điểm mạnh, điểm yếu**: Xác định điểm mạnh, điểm yếu trong kỹ năng nói
- **Đề xuất cải thiện**: Đưa ra các gợi ý để cải thiện kỹ năng nói tiếng Nhật

## API Endpoints

Tất cả API endpoints yêu cầu xác thực bằng API key thông qua header `X-API-Key` hoặc query parameter `api_key`.

### GET /

- **Mô tả**: Kiểm tra trạng thái hoạt động của máy chủ
- **Phản hồi**: Thông tin về phiên bản và trạng thái
- **Ví dụ phản hồi**:
  ```json
  {
    "message": "Ringurooma Speech API Server",
    "version": "1.0.0",
    "status": "running",
    "features": [
      "Speech to Text (POST /api/speech-to-text)",
      "Real-time Speech to Text (WebSocket)",
      "Pronunciation Assessment (POST /api/pronunciation-assessment)",
      "Text to Speech (POST /api/text-to-speech)",
      "Intent Recognition (POST /api/intent-recognition)"
    ]
  }
  ```

### POST /api/speech-to-text

- **Mô tả**: Chuyển đổi âm thanh thành văn bản
- **Content-Type**: multipart/form-data hoặc application/json (nếu sử dụng base64)
- **Tham số**:
  - **Sử dụng file**:
    - `audio`: File âm thanh (WAV) - *bắt buộc*
    - `user_id`: ID người dùng - *tùy chọn*
  - **Sử dụng base64**:
    - `audio_base64`: Chuỗi base64 của âm thanh - *bắt buộc*
    - `user_id`: ID người dùng - *tùy chọn*
    - **Headers**:
      - `X-Audio-Format`: `base64` - *bắt buộc*
- **Giới hạn**: Kích thước file tối đa 10MB
- **Phản hồi**: Văn bản được nhận dạng từ âm thanh
- **Ví dụ phản hồi**:
  ```json
  {
    "user_id": "test-user-001",
    "transcription": "こんにちは、私の名前は田中です。",
    "timestamp": "2025-05-18T07:31:28.123Z"
  }
  ```

### POST /api/pronunciation-assessment

- **Mô tả**: Đánh giá phát âm tiếng Nhật dựa trên âm thanh và văn bản tham chiếu
- **Content-Type**: multipart/form-data hoặc application/json (nếu sử dụng base64)
- **Tham số**:
  - **Sử dụng file**:
    - `audio`: File âm thanh (WAV) - *bắt buộc*
    - `reference_text`: Văn bản tham chiếu tiếng Nhật - *bắt buộc*
    - `user_id`: ID người dùng - *tùy chọn*
  - **Sử dụng base64**:
    - `audio_base64`: Chuỗi base64 của âm thanh - *bắt buộc*
    - `reference_text`: Văn bản tham chiếu tiếng Nhật - *bắt buộc*
    - `user_id`: ID người dùng - *tùy chọn*
    - **Headers**:
      - `X-Audio-Format`: `base64` - *bắt buộc*
      - `Content-Type`: `application/json` - *bắt buộc*
- **Giới hạn**: Kích thước file tối đa 10MB
- **Phản hồi**: Kết quả đánh giá chi tiết
- **Ví dụ phản hồi**:
  ```json
  {
    "user_id": "test-user-001",
    "reference_text": "こんにちは、私の名前は田中です。",
    "transcription": {
      "fromRecognition": "こんにちは、私の名前は田中です。",
      "fromAssessment": "こんにちは、私の名前は田中です。"
    },
    "jlpt_level": "N3",
    "pronunciation_scores": {
      "accuracy": 85.7,
      "fluency": 79.3,
      "completeness": 95.0,
      "pronunciation": 82.5,
      "prosody": 75.2
    },
    "speech_rate": {
      "words_per_minute": 120,
      "assessment": {
        "rating": "good",
        "feedback": "Tốc độ nói phù hợp, gần với tốc độ nói tự nhiên của người bản xứ."
      }
    },
    "word_stress": {
      "overall_score": 76.5,
      "details": [...]
    },
    "analysis": {
      "strengths": ["Phát âm chính xác các từ vựng", "Nói đầy đủ nội dung so với văn bản tham chiếu"],
      "weaknesses": ["Ngữ điệu chưa tự nhiên, còn đơn điệu"],
      "improvement_suggestions": ["Nghe và bắt chước ngữ điệu của người bản xứ, tập trung vào cao độ và trọng âm"]
    },
    "word_details": [...],
    "phoneme_details": [...],
    "benchmark_comparison": {
      "accuracy_vs_benchmark": "5.70",
      "fluency_vs_benchmark": "-0.70",
      "overall_vs_benchmark": "2.50"
    },
    "timestamp": "2025-05-18T07:31:28.123Z"
  }
  ```

### POST /api/text-to-speech

- **Mô tả**: Chuyển đổi văn bản thành giọng nói
- **Content-Type**: application/json
- **Tham số**:
  - `text`: Văn bản cần chuyển đổi thành giọng nói - *bắt buộc*
  - `voice_name`: Tên giọng đọc (mặc định: 'ja-JP-NanamiNeural') - *tùy chọn*
- **Phản hồi**: File âm thanh MP3
- **Response Headers**:
  - `Content-Type`: audio/mp3
  - `Content-Disposition`: attachment; filename="tts-[timestamp].mp3"

### POST /api/intent-recognition

- **Mô tả**: Nhận dạng ý định từ văn bản hoặc âm thanh
- **Content-Type**: multipart/form-data hoặc application/json
- **Tham số**:
  - **Đầu vào là văn bản** (application/json):
    - `text`: Văn bản cần nhận dạng ý định - *bắt buộc*
    - `user_id`: ID người dùng - *tùy chọn*
  - **Đầu vào là âm thanh** (multipart/form-data):
    - `audio`: File âm thanh (WAV) - *bắt buộc*
    - `user_id`: ID người dùng - *tùy chọn*
  - **Đầu vào là âm thanh base64** (application/json):
    - `audio_base64`: Chuỗi base64 của âm thanh - *bắt buộc*
    - `user_id`: ID người dùng - *tùy chọn*
    - **Headers**:
      - `X-Audio-Format`: `base64` - *bắt buộc*
- **Giới hạn**: Kích thước file tối đa 10MB (đối với đầu vào âm thanh)
- **Phản hồi**: Kết quả nhận dạng ý định
- **Ví dụ phản hồi**:
  ```json
  {
    "user_id": "test-user-001",
    "query": "こんにちは、初めまして。お願いします。",
    "intent": {
      "top": "Greeting",
      "confidence": 0.5
    },
    "intents": {
      "Greeting": 2,
      "Request": 1,
      "Farewell": 0,
      "Question": 0,
      "Affirmation": 0,
      "Negation": 0,
      "Opinion": 0
    },
    "entities": [],
    "timestamp": "2025-05-18T07:45:12.456Z"
  }
  ```

### WebSocket Endpoint (/) - Nhận dạng giọng nói thời gian thực

- **Mô tả**: Kết nối WebSocket để nhận dạng giọng nói theo thời gian thực
- **Giao thức**: WebSocket (ws:// hoặc wss://)
- **Quy trình**:
  1. Kết nối tới WebSocket endpoint
  2. Gửi lệnh bắt đầu: `{"command": "start"}`
  3. Gửi dữ liệu âm thanh dưới dạng binary data
  4. Nhận kết quả nhận dạng theo thời gian thực
  5. Gửi lệnh dừng: `{"command": "stop"}`
- **Định dạng tin nhắn từ server**:
  ```json
  {
    "type": "recognition",
    "result": {
      "type": "recognizing", // hoặc "recognized"
      "text": "こんにちは",
      "isFinal": false // true nếu là kết quả cuối cùng
    }
  }
  ```

## JLPT Level Mapping

Dịch vụ tự động xác định cấp độ JLPT dựa trên điểm phát âm:

| JLPT Level | Điểm phát âm |
|------------|--------------|
| N1         | 90-100       |
| N2         | 80-89        |
| N3         | 70-79        |
| N4         | 60-69        |
| N5         | <60          |

## Cài đặt và chạy

### Cài đặt thủ công
1. Clone repository
2. Cài đặt dependencies: `npm install`
3. Cấu hình môi trường: Tạo file `.env` với các biến:
   ```
   SPEECH_KEY=your_azure_speech_key
   SPEECH_REGION=your_azure_region
   API_KEY=your_api_authentication_key
   PORT=3000 (optional)
   ```
4. Chạy dịch vụ: `node server.js` hoặc `npm start`

### Triển khai với Docker
1. Đảm bảo Docker và Docker Compose đã được cài đặt
2. Tạo file `.env` với các biến môi trường cần thiết
3. Chạy: `docker-compose up -d`

### Cấu hình SSL/HTTPS
Sử dụng script `setup-ssl.sh` để thiết lập SSL với Let's Encrypt:
```bash
./setup-ssl.sh your-domain.com
```

## Ví dụ sử dụng API

### cURL

#### Chuyển đổi giọng nói thành văn bản (sử dụng file)
```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -F "audio=@/path/to/audio.wav" \
  -F "user_id=test-user" \
  https://your-domain.com/api/speech-to-text
```

#### Đánh giá phát âm (sử dụng file)
```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -F "audio=@/path/to/audio.wav" \
  -F "reference_text=こんにちは、私の名前は田中です。" \
  -F "user_id=test-user" \
  https://your-domain.com/api/pronunciation-assessment
```

#### Đánh giá phát âm (sử dụng base64)
```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -H "X-Audio-Format: base64" \
  -d '{
    "audio_base64": "UklGRiSFAABXQVZFLAAAAAA=...",
    "reference_text": "こんにちは、私の名前は田中です。",
    "user_id": "test-user"
  }' \
  https://your-domain.com/api/pronunciation-assessment
```

#### Chuyển đổi văn bản thành giọng nói
```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは、私の名前は田中です。", "voice_name":"ja-JP-NanamiNeural"}' \
  --output speech.mp3 \
  https://your-domain.com/api/text-to-speech
```

#### Nhận dạng ý định từ văn bản
```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは、初めまして。お願いします。", "user_id":"test-user"}' \
  https://your-domain.com/api/intent-recognition
```

#### Nhận dạng ý định từ âm thanh base64
```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -H "X-Audio-Format: base64" \
  -d '{
    "audio_base64": "UklGRiSFAABXQVZFLAAAAAA=...",
    "user_id": "test-user"
  }' \
  https://your-domain.com/api/intent-recognition
```

## Yêu cầu

- Node.js 14+
- Tài khoản Azure Speech Service
- Kết nối internet để sử dụng Azure Speech SDK

## Kiểm thử API

Sử dụng script `test-api.js` để kiểm thử các API endpoints:

```bash
# Kiểm thử tất cả API
node test-api.js --all

# Kiểm thử từng API riêng biệt
node test-api.js --stt           # Speech to Text
node test-api.js --pronunciation # Pronunciation Assessment
node test-api.js --pronunciation-base64 # Pronunciation Assessment với base64
node test-api.js --tts           # Text to Speech
node test-api.js --intent        # Intent Recognition
node test-api.js --realtime      # Real-time Speech Recognition (WebSocket)
```

## Tài nguyên

- [Tài liệu Azure Speech SDK](https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/)
- [Hướng dẫn Pronunciation Assessment API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text#pronunciation-assessment-parameters)
