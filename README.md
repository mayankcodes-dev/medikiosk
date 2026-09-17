# MediKiosk — AI Clinical History Kiosk

> **AI-powered multilingual clinical history-taking platform for Indian hospitals and AYUSH clinics.**
> Captures structured patient history through natural voice conversation and guided touchscreen interaction — in 22 Indian languages — before the patient enters the consultation room.

![Next.js](https://img.shields.io/badge/Next.js_15-black?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?logo=google&logoColor=white) ![Groq](https://img.shields.io/badge/Groq-F55036?logoColor=white) ![Bhashini](https://img.shields.io/badge/Bhashini-138808?logoColor=white)

---

## The Problem

Indian OPDs see 4,000–10,000 patients daily with 2–5 minute consultations. Doctors spend most of that time *asking* history instead of *examining and counselling*. AYUSH practitioners face even more complexity — Dashavidha Pariksha requires 10+ constitutional parameters that are impossible to capture manually under time pressure.

**MediKiosk solves this by conducting the entire clinical history interview autonomously, in the patient''s own language, before they enter the consultation room.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Patient Kiosk UI                       │
│  Next.js App Router · React 19 · Tailwind CSS · PWA      │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────────┐
│  Groq AI     │ │ Gemini AI   │ │  Bhashini API    │
│  Conversation│ │ Summary +   │ │  ASR + TTS       │
│  Engine      │ │ Vision OCR  │ │  22 Indian Langs │
└──────────────┘ └─────────────┘ └──────────────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌──────────────────────┐  ┌────────────────────────┐
│  Neon Serverless DB  │  │  ABDM / FHIR R4 API    │
└──────────────────────┘  └────────────────────────┘
```

---

## Four Modules

### Module A — Conversational Multimodal History Engine
- **Adaptive AI interviewer** using Groq''s ultra-fast inference — branches questions based on symptoms (SOCRATES framework)
- **Dual-mode input**: Natural voice via **Bhashini ASR** + guided touchscreen chips
- **Text-to-speech** via **Bhashini TTS** — question read aloud automatically in patient''s language on every page load
- **22 Indian languages** including all 8th Schedule languages
- **AYUSH Dashavidha Pariksha**: All 10 constitutional parameters (Prakriti, Vikriti, Sara, Samhanana, Satmya, Pramana, Sattva, Ahara Shakti, Vyayama Shakti, Vaya)
- **Red-flag detection**: Cardiac, stroke, breathing, bleeding, and psychiatric emergencies flagged in real-time
- **Triple-fallback AI**: Groq → Gemini → Offline deterministic questions (never breaks the interview)

### Module B — Medical Document Digitization & Intelligence
- **Gemini Vision OCR** for handwritten prescriptions, printed lab reports, and discharge summaries
- **Intelligent extraction**: Medications with dosages, lab values with reference ranges, diagnoses
- **Multi-pass extraction** with OCR dosage normalization (`5OOmg` → `500mg`)
- **Abnormal-value highlighting**: ⬆ HIGH (red), ⬇ LOW (blue), ✓ NORMAL (green)
- **Chronological timeline** organization by document date

### Module C — Structured History Summary Generator
- **Standard clinical format**: Chief Complaint → HPI → PMHx → Drug/Allergy → Family → Personal → ROS
- **AI-generated narrative summary** with ICD-10 code suggestions
- **Professional A4 print-ready report** with DRAFT watermark
- **AYUSH section** with all Dashavidha Pariksha parameters

### Module D — Consent, Privacy & ABDM Integration
- **ABHA ID / Aadhaar OTP / Mobile OTP** — patients authenticate with any method
- **ABDM consent framework** — compliant with Digital Personal Data Protection Act 2023
- **Granular consent toggles** with Bhashini TTS audio explanation in patient''s language
- **FHIR R4 API** resource generation for hospital HIS integration
- **Session termination**: All PII cleared after the kiosk session ends

---

## Bhashini Integration

[Bhashini](https://bhashini.gov.in) is India''s National Language Translation Mission — a Government of India initiative for Indian language AI services.

| Service | Usage in MediKiosk |
|---------|-------------------|
| **ASR (Speech-to-Text)** | Converts patient''s spoken words to text in real-time across 22 Indian languages with 10s timeout |
| **TTS (Text-to-Speech)** | Reads every question and instruction aloud automatically — critical for low-literacy and elderly patients |

Bhashini is used because it is purpose-built for Indian languages, government-backed, and directly integrated with the ABDM ecosystem.

---

## ABDM / ABHA Integration

[ABDM (Ayushman Bharat Digital Mission)](https://abdm.gov.in) is India''s national digital health infrastructure.

| Feature | Details |
|---------|---------|
| **ABHA ID Login** | Patients authenticate with their 14-digit Ayushman Bharat Health Account ID |
| **Aadhaar OTP Auth** | Biometric-backed authentication via Aadhaar OTP |
| **Mobile OTP** | SMS OTP via Twilio — HMAC-SHA256 hashed, 60s rate-limited, auto-cleared on session end |
| **ABDM Consent** | Granular per-purpose consent per ABDM Health Data Management Policy |
| **FHIR R4** | Clinical summary exported as FHIR R4 resources for HIS integration |
| **DPDP Compliance** | Session data deleted when the kiosk session ends — no PII persisted on device |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion |
| **AI — Conversation** | Groq API (ultra-fast LLM inference), Gemini Flash as fallback |
| **AI — Summary & OCR** | Google Gemini 2.5 Flash (structured JSON + Vision OCR) |
| **Speech** | Bhashini ASR (speech-to-text) + Bhashini TTS (text-to-speech) — 22 Indian languages |
| **Database** | Neon Serverless Postgres |
| **Auth** | ABHA ID, Aadhaar OTP, Mobile OTP (Twilio) |
| **Interoperability** | FHIR R4 resource generation, ABDM consent framework |
| **Deployment** | Vercel (Edge + Serverless) |
| **PWA** | Service Worker, offline fallback questions |

---

## Network Resilience

Built for Indian hospital networks (intermittent WiFi, shared mobile data):

- **AbortSignal timeouts**: Groq 12s, Gemini 15s, Bhashini ASR 10s, Bhashini TTS 8s
- **Client-side `resilientFetch`** with automatic retries and exponential backoff
- **Triple AI fallback**: Groq → Gemini → Offline static questions (11 languages, clinically vetted)
- **Graceful degradation**: OCR returns low-confidence fallback instead of breaking the flow
- **Non-blocking DB writes**: Session continues even if Neon write fails

---

## Accessibility & Kiosk UX

- **18px base font** for elderly/low-vision patients
- **48px minimum tap targets** on all interactive elements; 96×96px microphone button
- **Audio-first**: Every question and instruction read aloud via Bhashini TTS automatically
- **Reduced-motion**: Respects `prefers-reduced-motion` system setting
- **Safe-area insets**: Works on notched/curved kiosk displays
- **WCAG AA** color contrast across all components

---

## Getting Started

```bash
git clone https://github.com/mayankcodes-dev/medikiosk.git
cd medikiosk/product
npm install
cp .env.example .env.local   # Fill in API keys
npm run dev                   # http://localhost:3000
```

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini — summary + Vision OCR |
| `GROQ_API_KEY` | Groq — conversation engine |
| `DATABASE_URL` | Neon Postgres connection string |
| `BHASHINI_API_KEY` | Bhashini ASR/TTS |
| `BHASHINI_USER_ID` | Bhashini user ID |
| `TWILIO_ACCOUNT_SID` | Twilio SMS |
| `TWILIO_AUTH_TOKEN` | Twilio auth |
| `TWILIO_PHONE` | Twilio sender number |
| `OTP_SECRET` | HMAC secret for OTP hashing |

---

## Project Structure

```
medikiosk/
├── product/                    # Next.js application
│   ├── src/app/
│   │   ├── page.tsx             # Language selection (22 languages)
│   │   ├── login/               # ABHA / Aadhaar / Mobile OTP auth
│   │   ├── consent/             # ABDM consent with Bhashini TTS
│   │   ├── opd-select/          # General OPD vs AYUSH OPD
│   │   ├── history/             # Voice + touch clinical interview
│   │   ├── scan/                # Document OCR & extraction
│   │   ├── summary/             # AI summary + print report
│   │   ├── doctor/              # Physician review dashboard
│   │   └── api/
│   │       ├── history/chat/    # Groq conversation engine
│   │       ├── scan/extract/    # Gemini Vision OCR
│   │       ├── bhashini/asr/    # Bhashini speech-to-text
│   │       ├── bhashini/tts/    # Bhashini text-to-speech
│   │       ├── auth/            # ABHA / OTP auth
│   │       ├── fhir/            # FHIR R4 generation
│   │       └── session/         # Neon DB persistence
│   └── src/lib/
│       ├── translations.ts      # 22 language strings
│       ├── resilientFetch.ts    # Network retry utility
│       └── constants.ts         # Language list, stages
└── landingPage/                 # Public marketing site
```

---

## Patient Journey

```
Language Select (22 langs)
  → Login (ABHA / Aadhaar OTP / Mobile OTP)
  → Consent (ABDM + DPDP 2023 + Bhashini audio)
  → OPD Select (General / AYUSH)
  → Clinical Interview (Voice + Touch, Bhashini ASR/TTS)
  → Document Scan & OCR (Gemini Vision)
  → AI Summary (Groq → Gemini)
  → Doctor Review Dashboard
  → Session Complete & PII Cleared
```

---

*Built for the All India Institute of Ayurveda, Ministry of AYUSH — Smart India Hackathon 2026*
