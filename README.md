# MediKiosk — AI Clinical History Kiosk

> **AI-powered multilingual clinical history-taking platform for Indian hospitals and AYUSH clinics.**
> Captures structured patient history through natural voice conversation and guided touchscreen interaction — in 22 Indian languages — before the patient enters the consultation room.

![Next.js](https://img.shields.io/badge/Next.js_15-black?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?logo=google&logoColor=white) ![Grok](https://img.shields.io/badge/Grok_xAI-000?logo=x&logoColor=white)

---

## The Problem

Indian OPDs see 4,000–10,000 patients daily with 2–5 minute consultations. Doctors spend most of that time *asking* history instead of *examining and counseling*. AYUSH practitioners face even more complexity — Dashavidha Pariksha requires 10+ constitutional parameters that are impossible to capture manually under time pressure.

**MediKiosk solves this by conducting the entire clinical history interview autonomously, in the patient's own language, before they enter the consultation room.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Patient Kiosk UI                       │
│  Next.js App Router · React 19 · Tailwind CSS · PWA      │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │  Login    │ │ Consent  │ │History │ │   Summary    │  │
│  │  (ABHA)  │ │ (DPDP)   │ │(Voice) │ │   (Report)   │  │
│  └──────────┘ └──────────┘ └────────┘ └──────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌─────────────┐
│  Grok (xAI)  │ │ Gemini AI   │ │  Bhashini   │
│  Conversation│ │ Summary +   │ │  ASR + TTS  │
│  Engine      │ │ Vision OCR  │ │  22 Langs   │
└──────────────┘ └─────────────┘ └─────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        ▼
              ┌──────────────────┐
              │   Neon Postgres  │
              │   + FHIR API     │
              └──────────────────┘
```

---

## Four Modules

### Module A — Conversational Multimodal History Engine
- **Adaptive AI interviewer** that branches questions based on symptoms (SOCRATES framework)
- **Dual-mode input**: Natural voice (Bhashini ASR) + touch-based multiple-choice chips
- **22 Indian languages** with real-time speech recognition and text-to-speech
- **AYUSH Dashavidha Pariksha**: All 10 constitutional parameters (Prakriti, Vikriti, Sara, Samhanana, Satmya, Pramana, Sattva, Ahara Shakti, Vyayama Shakti, Vaya)
- **Red-flag detection**: Cardiac, stroke, breathing, bleeding, and psychiatric emergencies flagged in real-time across 11 languages
- **Triple-fallback AI**: Grok → Gemini → Offline deterministic questions

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
- **Doctor dashboard** for physician review and confirmation

### Module D — Consent, Privacy & ABDM Integration
- **ABHA ID / Aadhaar / Mobile OTP** authentication
- **ABDM consent framework** compliant with Digital Personal Data Protection Act 2023
- **Granular consent toggles** with audio explanation in patient's language
- **FHIR R4 API** for hospital HIS integration
- **Session termination**: All temporary data cleared after submission

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion |
| **AI — Conversation** | Grok (xAI) via OpenAI-compatible API, with Gemini fallback |
| **AI — Summary & OCR** | Google Gemini 2.5 Flash (structured JSON generation + Vision OCR) |
| **Speech** | Bhashini ASR (speech-to-text) + TTS (text-to-speech) — 22 Indian languages |
| **Database** | Neon Serverless Postgres |
| **Auth** | ABHA ID, Aadhaar OTP, Mobile OTP (Twilio) |
| **Interop** | FHIR R4 resource generation |
| **Deployment** | Vercel (Edge + Serverless) |
| **PWA** | Service Worker, offline fallback questions |

---

## Network Resilience

Built for Indian hospital networks (intermittent WiFi, shared mobile data):

- **AbortSignal timeouts** on all external API calls (12s Grok, 15s Gemini, 10s Bhashini)
- **Client-side `resilientFetch`** with automatic retries, exponential backoff, and timeout
- **Triple AI fallback**: If all LLMs fail, serves clinically vetted static questions offline
- **Graceful degradation**: OCR returns low-confidence fallback instead of errors
- **Non-blocking DB writes**: Session continues even if Neon DB write fails

---

## Accessibility & Kiosk Design

- **18px base font** (1.125rem) for elderly/low-vision patients
- **48px minimum tap targets** on all interactive elements
- **96×96px microphone button** for the primary voice interaction
- **Audio-first**: Every screen reads its content aloud via TTS
- **Reduced-motion support**: Respects `prefers-reduced-motion`
- **Safe-area insets**: Works on notched/curved screen devices
- **High-contrast tokens**: WCAG AA compliant color palette

---

## Getting Started

```bash
# Clone
git clone https://github.com/your-org/medikiosk.git
cd medikiosk/product

# Install
npm install

# Environment
cp .env.example .env.local
# Fill in: GEMINI_API_KEY, GROK_API_KEY, DATABASE_URL, TWILIO_*, BHASHINI_*

# Dev
npm run dev

# Build
npm run build && npm start
```

---

## Project Structure

```
medikiosk/
├── product/                    # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Language selection (landing)
│   │   │   ├── login/           # ABHA / Aadhaar / Mobile auth
│   │   │   ├── consent/         # DPDP consent with TTS
│   │   │   ├── opd-select/      # General OPD vs AYUSH OPD
│   │   │   ├── history/         # Voice + touch clinical interview
│   │   │   ├── scan/            # Document OCR & extraction
│   │   │   ├── summary/         # AI summary + print report
│   │   │   ├── doctor/          # Physician review dashboard
│   │   │   ├── complete/        # Session end
│   │   │   └── api/
│   │   │       ├── history/chat/ # AI conversation engine
│   │   │       ├── scan/extract/ # Gemini Vision OCR
│   │   │       ├── bhashini/     # ASR + TTS proxy
│   │   │       ├── auth/         # OTP generation & verification
│   │   │       ├── fhir/         # FHIR R4 resource generation
│   │   │       ├── session/      # Neon DB persistence
│   │   │       └── rag/          # Clinical knowledge retrieval
│   │   ├── components/          # KioskScreen, LangSync, etc.
│   │   └── lib/                 # translations, constants, resilientFetch
│   └── public/                  # PWA manifest, logo, icons
└── landing/                     # Marketing / info site
```

---

## Patient Journey

```
Language Select → Login (ABHA) → Consent → OPD Select
    → Voice/Touch History Interview (7 standard + 15 AYUSH stages)
    → Document Scan & OCR
    → AI Summary Generation
    → Doctor Review → Complete
```

---

## Key Design Decisions

1. **Grok for conversation, Gemini for summary** — Grok is faster for real-time Q&A; Gemini excels at structured JSON generation and vision tasks
2. **No EasyOCR/Tesseract** — Gemini Vision handles OCR + understanding + structuring in one call, no Python runtime needed
3. **Offline-first fallback questions** — Clinically vetted static questions in 11 languages ensure the interview never breaks
4. **Session-based state** — `sessionStorage` (not cookies/localStorage) ensures data is cleared when the browser tab closes
5. **AYUSH as a first-class mode** — Not an afterthought; dedicated interview stages, display sections, and report formatting

---

## License

MIT

---

*Built for the All India Institute of Ayurveda, Ministry of AYUSH — Smart India Hackathon 2026*
