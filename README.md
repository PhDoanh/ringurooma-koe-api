# Ringurooma Koe API

> Orginal name: リングローマの音声API 

This repository is an intermediate microservice, communicating with the Azure Speech SDK for processing and assessing Japanese speaking skills, independently developed by the [Ringurooma](https://github.com/HuyDang05/Ringurooma) project. Therefore, any application that supports the REST API can use it!

## Feature

- **Speech to Text**: Recognize and convert Japanese speech to text
- **Pronunciation Assessment**: Japanese pronunciation accuracy assessment on a 100-point scale
- **Intonation and Tone Analysis**: Assessing the naturalness of intonation when speaking Japanese
- **Speaking speed assessment**: Analyze and evaluate whether the speaking speed is appropriate or not
- **Vocabulary Accent Analysis**: Evaluate the correct placement of accents in words
- **Strengths and weaknesses analysis**: Identify strengths and weaknesses in speaking skills
- **Suggestions for improvement**: Give suggestions to improve your Japanese speaking skills

## API Endpoints

All API endpoints require authentication with an API key via the `X-API-Key` header or query parameter `api_key`.

### GET `/`

- **Description**: Check the operating status of the server
- **Response**: Version and status information
- **Example response**:

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

### POST `/api/speech-to-text`

- **Description**: Convert audio to text
- **Content-Type**: `multipart/form-data` or `application/json` (if using base64)
- **Parameters**:
	- **File Usage**:
		- `audio`: Audio file (WAV) - *required*
		- `user_id`: User ID - *optional*
	- **Using base64**:
		- `audio_base64`: Base64 string of audio - *required*
		- `user_id`: User ID - *optional*
		- **Headers**:
			- `X-Audio-Format`: `base64` - *required*
- **Limit**: Maximum file size 10MB
- **Response**: Text recognized from audio
- **Example response**:

```json
{
  "user_id": "test-user-001",
  "transcription": "こんにちは、私の名前は田中です。",
  "timestamp": "2025-05-18T07:31:28.123Z"
}
```

### POST `/api/pronunciation-assessment`

- **Description**: Japanese pronunciation assessment based on sound and reference text
- **Content-Type**: `multipart/form-data` or `application/json` (if using base64)
- **Parameters**:
	- **File Usage**:
		- `audio`: Audio file (WAV) - *required*
		- `reference_text`: Japanese Reference Text - *Required*
		- `user_id`: User ID - *optional*
	- **Using base64**:
		- `audio_base64`: Base64 string of audio - *required*
		- `reference_text`: Japanese Reference Text - *Required*
		- `user_id`: User ID - *optional*
		- **Headers**:
			- `X-Audio-Format`: `base64` - *required*
			- `Content-Type`: `application/json` - *required*
- **Limit**: Maximum file size 10MB
- **Response**: Detailed review results
- **Example response**:

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

### POST `/api/text-to-speech`

- **Description: Text-to-speech conversion**
- **Content-Type**: `application/json`
- **Parameters**:
	- `text`: Text that needs to be converted to speech - *required*
	- `voice_name`: Voice name (default: 'ja-JP-NanamiNeural') – *optional*
- **Response**: MP3 audio file
- **Response Headers**:
	- `Content-Type`: `audio/mp3`
	- `Content-Disposition`: attachment; filename="tts-\[timestamp\].mp3"

### POST `/api/intent-recognition`

- **Description**: Identify intent from text or audio
- **Content-Type**: `multipart/form-data` or `application/json`
- **Parameters**:
	- **The input is text** (application/json):
		- `text`: Text that needs intent identification - *required*
		- `user_id`: User ID - *optional*
	- **Input is audio** (multipart/form-data):
		- `audio`: Audio file (WAV) - *required*
		- `user_id`: User ID - *optional*
	- **The input is base64** audio (application/json):
		- `audio_base64`: Base64 string of audio - *required*
		- `user_id`: User ID - *optional*
		- **Headers**:
			- `X-Audio-Format`: `base64` - *required*
- **Limit**: Maximum file size of 10MB (for audio input)
- **Response**: Intent Recognition Results
- **Example response**:

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

### WebSocket Endpoint - Real-Time Voice Recognition

- **Description**: WebSocket connection for real-time speech recognition
- **Protocol**: WebSocket (ws:// or wss://)
- **Process**:
	1. Connecting to a WebSocket endpoint
	2. Send the start command: `{"command": "start"}`
	3. Submit audio data as binary data
	4. Get real-time recognition results
	5. Send stop command: `{"command": "stop"}`
- **Message format from the server**:

```json
{
  "type": "recognition",
  "result": {
    "type": "recognizing", // or "recognized"
    "text": "こんにちは",
    "isFinal": false // true if final result
  }
}
```

## JLPT Level Mapping

The service automatically determines the JLPT level based on pronunciation scores:

| JLPT Level | Pronunciation Points |
| ---------- | -------------------- |
| N1         | 90-100               |
| N2         | 80-89                |
| N3         | 70-79                | 
| N4         | 60-69                |
| N5         | <60                  |

## Install and run

### Requirements

- Node.js 14+
- Azure Speech Service account
- Internet connection to use the Azure Speech SDK

### Manual Installation

1. Clone repository
2. Install dependencies: `npm install`
3. Configure the environment: Create an `.env` file with the following variables:

```
SPEECH_KEY=your_azure_speech_key
SPEECH_REGION=your_azure_region
API_KEY=your_api_authentication_key
PORT=3000 (optional)
```

4. Run the service: `node server.js` or `npm start`

### Deploy with Docker

1. Make sure Docker and Docker Compose are installed
2. Create an `.env` file with the necessary environment variables
3. Run: `docker-compose up -d`

### SSL/HTTPS Configuration

Use `setup-ssl.sh` script to set up SSL with Let's Encrypt:

```bash
./setup-ssl.sh your-domain.com
```

## Examples of using APIs with cURL

### Convert speech to text (using file)

```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -F "audio=@/path/to/audio.wav" \
  -F "user_id=test-user" \
  https://your-domain.com/api/speech-to-text
```

### Evaluation of pronunciation (using file)

```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -F "audio=@/path/to/audio.wav" \
  -F "reference_text=こんにちは、私の名前は田中です。" \
  -F "user_id=test-user" \
  https://your-domain.com/api/pronunciation-assessment
```

### Pronunciation evaluation (using base64)

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

### Convert text to speech

```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは、私の名前は田中です。", "voice_name":"ja-JP-NanamiNeural"}' \
  --output speech.mp3 \
  https://your-domain.com/api/text-to-speech
```

### Identifying intents from text

```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは、初めまして。お願いします。", "user_id":"test-user"}' \
  https://your-domain.com/api/intent-recognition
```

### Identify intents from base64 audio

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

## API Testing

Use `test-api.js` script to test API endpoints:

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

## References

- [Azure Speech SDK documentation](https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/)
- [Pronunciation Assessment API Guide](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text#pronunciation-assessment-parameters)

