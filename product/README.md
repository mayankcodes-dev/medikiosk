# MediKiosk — Product (Next.js Application)

> The core clinical history-taking application built with Next.js 15, React 19, and TypeScript.

## Quick Start

```bash
npm install
cp .env.example .env.local   # Fill API keys
npm run dev                   # http://localhost:3000
```

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini — summary generation + Vision OCR |
| `GROK_API_KEY` | xAI Grok — conversation engine |
| `GROK_API_URL` | xAI endpoint (default: `https://api.x.ai/v1`) |
| `DATABASE_URL` | Neon Postgres connection string |
| `BHASHINI_API_KEY` | Bhashini ASR/TTS for Indian languages |
| `BHASHINI_USER_ID` | Bhashini user ID |
| `TWILIO_ACCOUNT_SID` | Twilio — SMS OTP delivery |
| `TWILIO_AUTH_TOKEN` | Twilio auth |
| `TWILIO_PHONE` | Twilio sender number |
| `OTP_SECRET` | HMAC secret for OTP hashing |

## Build & Deploy

```bash
npm run build     # Production build
npm start         # Start production server
npx vercel        # Deploy to Vercel
```

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/history/chat` | POST | AI conversation engine (Grok → Gemini → offline) |
| `/api/scan/extract` | POST | Gemini Vision OCR for documents |
| `/api/bhashini/asr` | POST | Speech-to-text (22 languages) |
| `/api/bhashini/tts` | POST | Text-to-speech |
| `/api/auth/mobile-otp` | POST | OTP send & verify |
| `/api/session/save` | POST | Persist session to Neon DB |
| `/api/fhir/generate` | POST | FHIR R4 resource generation |
| `/api/rag/query` | POST | Clinical knowledge retrieval |
| `/api/queue/list` | GET | Patient queue |
| `/api/queue/update` | POST | Queue management |

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Language selection (22 languages) |
| `/login` | ABHA / Aadhaar / Mobile OTP auth |
| `/consent` | DPDP 2023 consent with audio |
| `/opd-select` | General OPD vs AYUSH OPD |
| `/history` | Voice + touch clinical interview |
| `/scan` | Document upload & OCR |
| `/summary` | AI summary + printable report |
| `/doctor` | Physician review dashboard |
| `/complete` | Session end & cleanup |
