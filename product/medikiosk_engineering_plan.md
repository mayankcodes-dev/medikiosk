# MediKiosk — Engineering Implementation Plan
## PS 26047 | Ministry of AYUSH | SIH 2026

---

## Table of Contents

1. [Answers to Technical Questions](#1-answers-to-technical-questions)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Iterative Development Phases](#3-iterative-development-phases)
4. [Phase 0 — UI Foundation & Deployment](#4-phase-0--ui-foundation--deployment)
5. [Module A — Conversational Multimodal History Engine](#5-module-a--conversational-multimodal-history-engine)
6. [Module B — Medical Document Digitization & Intelligence](#6-module-b--medical-document-digitization--intelligence)
7. [Module C — Structured History Summary Generator](#7-module-c--structured-history-summary-generator)
8. [Module D — Consent, Privacy & ABDM Integration](#8-module-d--consent-privacy--abdm-integration)
9. [RAG Engine — Clinical Knowledge Pipeline](#9-rag-engine--clinical-knowledge-pipeline)
10. [Database Schema Design](#10-database-schema-design)
11. [API Contract Specification](#11-api-contract-specification)
12. [Edge/Offline Architecture](#12-edgeoffline-architecture)
13. [Security & Compliance Architecture](#13-security--compliance-architecture)
14. [Deployment & DevOps](#14-deployment--devops)
15. [Testing Strategy](#15-testing-strategy)

---

## 1. Answers to Technical Questions

### Q1: How do we login users by their ABHA ID / Aadhaar ID?

**Three authentication methods — all via ABDM V3 APIs (no direct UIDAI license needed):**

#### Method 1: ABHA Number + OTP (Primary)
```
Patient enters 14-digit ABHA Number (91-XXXX-XXXX-XXXX)
    │
    ▼
POST /v3/profile/login/request/otp
  Body: { "scope": ["abha-login"], "loginHint": "abha-number", "loginId": "<RSA_ENCRYPTED_ABHA>", "otpSystem": "abdm" }
    │
    ▼
OTP sent to ABHA-registered mobile
    │
    ▼
Patient enters OTP (audio-guided)
    │
    ▼
POST /v3/profile/login/verify
  Body: { "txnId": "<txn>", "authData": { "otp": { "otpValue": "<RSA_ENCRYPTED_OTP>" } } }
    │
    ▼
Returns: Patient Profile (name, gender, DOB, photo) + Session Token
```

#### Method 2: Aadhaar OTP (For new ABHA creation)
```
Patient enters Aadhaar (or scans Aadhaar QR)
    │
    ▼
POST /v3/enrollment/request/otp
  Body: { "scope": ["abha-enrol"], "loginHint": "aadhaar", "loginId": "<RSA_ENCRYPTED_AADHAAR>" }
    │
    ▼
OTP sent to Aadhaar-linked mobile → Patient verifies
    │
    ▼
POST /v3/enrollment/enrol/byAadhaar → Creates new ABHA → Returns profile + ABHA number
```

#### Method 3: Scan & Share (Fastest — QR Code)
```
Kiosk displays a unique QR code with facilityId + counterId
    │
    ▼
Patient scans QR using ABHA app (Aarogya Setu / ABHA app / Paytm)
    │
    ▼
ABDM pushes verified demographic token to our HIP Bridge callback
    │
    ▼
Instant authentication — no typing needed (< 30 seconds total)
```

> [!IMPORTANT]
> **We NEVER store raw Aadhaar numbers.** ABDM acts as the KUA (KYC User Agency). We only store the 14-digit ABHA number and the session token. All sensitive values (Aadhaar, OTP) are RSA-encrypted before transmission using the ABDM public certificate fetched from `GET /v3/profile/public/certificate`.

#### Implementation Code (Node.js)
```typescript
// services/abha-auth.service.ts
import crypto from 'crypto';
import axios from 'axios';

class ABHAAuthService {
  private readonly BASE_URL = process.env.ABDM_BASE_URL; // sandbox or prod
  private gatewayToken: string | null = null;
  private publicKey: string | null = null;

  // Step 0: Get gateway session token
  async getGatewayToken(): Promise<string> {
    const { data } = await axios.post(`${this.BASE_URL}/gateway/v3/sessions`, {
      clientId: process.env.ABDM_CLIENT_ID,
      clientSecret: process.env.ABDM_CLIENT_SECRET,
      grantType: 'client_credentials'
    });
    this.gatewayToken = data.accessToken;
    return data.accessToken;
  }

  // Step 1: Fetch ABDM RSA public key for encryption
  async fetchPublicCert(): Promise<string> {
    const { data } = await axios.get(`${this.BASE_URL}/abha/api/v3/profile/public/certificate`);
    this.publicKey = data;
    return data;
  }

  // Encrypt sensitive data with ABDM RSA public key
  encrypt(plainText: string): string {
    const buffer = Buffer.from(plainText, 'utf8');
    const encrypted = crypto.publicEncrypt(
      { key: this.publicKey!, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      buffer
    );
    return encrypted.toString('base64');
  }

  // Step 2: Request OTP for ABHA login
  async requestLoginOTP(abhaNumber: string): Promise<{ txnId: string }> {
    const { data } = await axios.post(
      `${this.BASE_URL}/abha/api/v3/profile/login/request/otp`,
      {
        scope: ['abha-login'],
        loginHint: 'abha-number',
        loginId: this.encrypt(abhaNumber),
        otpSystem: 'abdm'
      },
      { headers: { Authorization: `Bearer ${this.gatewayToken}` } }
    );
    return { txnId: data.txnId };
  }

  // Step 3: Verify OTP and get patient profile
  async verifyOTP(txnId: string, otp: string): Promise<PatientProfile> {
    const { data } = await axios.post(
      `${this.BASE_URL}/abha/api/v3/profile/login/verify`,
      {
        txnId,
        authData: { otp: { otpValue: this.encrypt(otp) } }
      },
      { headers: { Authorization: `Bearer ${this.gatewayToken}` } }
    );
    return {
      abhaNumber: data.ABHANumber,
      abhaAddress: data.preferredAbhaAddress,
      name: data.name,
      gender: data.gender,
      dob: data.yearOfBirth,
      mobile: data.mobile,
      photo: data.profilePhoto // base64
    };
  }
}
```

---

### Q2: How do we establish multilinguality in the voice agent?

**Three-layer architecture using Bhashini + AI4Bharat:**

```
┌─────────────────────────────────────────────────────────────────┐
│                  MULTILINGUAL VOICE PIPELINE                     │
│                                                                  │
│  Layer 1: SPEECH → TEXT (ASR)                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Patient speaks in ANY of 22 Indian languages              │    │
│  │     ↓                                                     │    │
│  │ Bhashini ASR API / AI4Bharat IndicConformer               │    │
│  │ (Streaming WebSocket: wss://dhruva-api.bhashini.gov.in)   │    │
│  │     ↓                                                     │    │
│  │ Output: Native language text (e.g., "मुझे सीने में दर्द है") │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Layer 2: TEXT → LLM PROCESSING (NMT + LLM + RAG)               │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ IndicTrans2 NMT: Hindi → English                         │    │
│  │     ↓                                                     │    │
│  │ LLM + RAG Engine processes in English                     │    │
│  │ (Clinical reasoning, next question generation)            │    │
│  │     ↓                                                     │    │
│  │ IndicTrans2 NMT: English → Hindi (patient's language)     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Layer 3: TEXT → SPEECH (TTS)                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Bhashini TTS / IndicTTS                                   │    │
│  │ Natural voice response in patient's language               │    │
│  │ Male/Female voice selection                                │    │
│  │ Audio streamed to speaker                                  │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Bhashini API Integration (2-step pipeline):**

```typescript
// services/bhashini-voice.service.ts
class BhashiniVoiceService {
  private CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
  private cachedConfigs: Map<string, PipelineConfig> = new Map();

  // Step 1: Get pipeline config (cache for 24h)
  async getPipelineConfig(sourceLang: string, tasks: string[]): Promise<PipelineConfig> {
    const cacheKey = `${sourceLang}_${tasks.join('_')}`;
    if (this.cachedConfigs.has(cacheKey)) return this.cachedConfigs.get(cacheKey)!;

    const { data } = await axios.post(this.CONFIG_URL, {
      pipelineTasks: tasks.map(task => ({
        taskType: task,
        config: { language: { sourceLanguage: sourceLang } }
      })),
      pipelineRequestConfig: { pipelineId: '64392f96daac500b55c543d6' }
    }, {
      headers: {
        userID: process.env.BHASHINI_USER_ID,
        ulcaApiKey: process.env.BHASHINI_API_KEY
      }
    });

    const config = {
      endpoint: data.pipelineInferenceAPIEndPoint.callbackUrl,
      authKey: data.pipelineInferenceAPIEndPoint.inferenceApiKey,
      services: data.pipelineResponseConfig
    };
    this.cachedConfigs.set(cacheKey, config);
    return config;
  }

  // Step 2: ASR — Speech to Text
  async speechToText(audioBase64: string, lang: string): Promise<string> {
    const config = await this.getPipelineConfig(lang, ['asr']);
    const serviceId = config.services[0].config[0].serviceId;

    const { data } = await axios.post(config.endpoint, {
      pipelineTasks: [{
        taskType: 'asr',
        config: {
          language: { sourceLanguage: lang },
          serviceId,
          audioFormat: 'wav',
          samplingRate: 16000
        }
      }],
      inputData: { audio: [{ audioContent: audioBase64 }] }
    }, {
      headers: { [config.authKey.name]: config.authKey.value }
    });

    return data.pipelineResponse[0].output[0].source;
  }

  // Translate text between languages
  async translate(text: string, srcLang: string, tgtLang: string): Promise<string> {
    const config = await this.getPipelineConfig(srcLang, ['translation']);
    const { data } = await axios.post(config.endpoint, {
      pipelineTasks: [{
        taskType: 'translation',
        config: {
          language: { sourceLanguage: srcLang, targetLanguage: tgtLang },
          serviceId: config.services[0].config[0].serviceId
        }
      }],
      inputData: { input: [{ source: text }] }
    }, {
      headers: { [config.authKey.name]: config.authKey.value }
    });
    return data.pipelineResponse[0].output[0].target;
  }

  // TTS — Text to Speech
  async textToSpeech(text: string, lang: string, gender = 'female'): Promise<string> {
    const config = await this.getPipelineConfig(lang, ['tts']);
    const { data } = await axios.post(config.endpoint, {
      pipelineTasks: [{
        taskType: 'tts',
        config: {
          language: { sourceLanguage: lang },
          serviceId: config.services[0].config[0].serviceId,
          gender,
          samplingRate: 22050
        }
      }],
      inputData: { input: [{ source: text }] }
    }, {
      headers: { [config.authKey.name]: config.authKey.value }
    });
    return data.pipelineResponse[0].audio[0].audioContent; // base64 WAV
  }
}
```

**Supported Languages (all 22 + English):**
Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi, Assamese, Urdu, Sanskrit, Maithili, Nepali, Sindhi, Konkani, Dogri, Manipuri, Bodo, Santali, Kashmiri, English

---

### Q3: How do we update ABHA records and inject into HIS?

**ABHA Record Update (as a Health Information Provider - HIP):**

```
MediKiosk generates structured clinical history
    │
    ▼
Format as FHIR R4 Bundle (NRCeS OPConsultRecord profile)
    │
    ├── Composition (document metadata)
    ├── Patient (ABHA-linked)
    ├── Encounter (this visit)
    ├── Condition[] (chief complaints, diagnoses)
    ├── Observation[] (symptoms, vitals, Prakriti/Vikriti)
    ├── MedicationStatement[] (from OCR'd past prescriptions)
    ├── AllergyIntolerance[] (reported allergies)
    ├── FamilyMemberHistory[] (family history)
    └── DocumentReference[] (scanned documents)
    │
    ▼
Register as HIP with ABDM Gateway
    │
    ▼
Link patient's ABHA with our facility
  POST /v0.5/links/link/add-contexts
  (adds "OPD Visit - 29 Aug 2026" as a Care Context)
    │
    ▼
When doctor confirms the summary → data is finalized
    │
    ▼
On consent-based request from any HIU:
  Encrypt FHIR Bundle using Fidelius protocol (Curve25519 + AES-256-GCM)
  Push to requesting HIU's dataPushUrl
```

**HIS Integration (3 patterns supported):**

```
Pattern 1: FHIR REST API (Modern HIS)
  POST /fhir/r4/Bundle → Push FHIR document directly

Pattern 2: HL7 v2 Message (Legacy HIS)
  MediKiosk → OpenHIM Middleware → HL7 ADT/ORU message → HIS

Pattern 3: Database Bridge (Fallback)
  MediKiosk → Secure API → INSERT into HIS database tables
  (with hospital IT team providing schema mapping)

Pattern 4: PDF Export (Universal Fallback)
  Generate structured PDF summary → email/print for doctor's screen
```

---

### Q4: How can we enable dynamic history-taking with RAG?

**RAG Architecture for Clinical Questioning:**

```
Patient says: "मुझे सीने में दर्द है" (I have chest pain)
    │
    ▼ (translated to English)
Intent Classification: "Chief Complaint = Chest Pain"
    │
    ▼
RAG Vector Search (ChromaDB / Qdrant):
    │
    ├── Query: "chest pain clinical history assessment protocol"
    │
    ├── Retrieved Document 1: SOCRATES Framework
    │   Site, Onset, Character, Radiation, Associated symptoms,
    │   Time/duration, Exacerbating/relieving, Severity
    │
    ├── Retrieved Document 2: ACS Red Flags
    │   Central crushing pain, radiation to jaw/left arm,
    │   sweating, nausea, dyspnoea → EMERGENCY TRIAGE
    │
    ├── Retrieved Document 3: Differential Diagnoses
    │   Cardiac (MI, Angina), Pulmonary (PE, Pneumothorax),
    │   GI (GERD, Esophageal spasm), MSK (Costochondritis)
    │
    └── Retrieved Document 4: Wells' Score for PE
        Criteria for scoring pulmonary embolism risk
    │
    ▼
LLM Prompt (with retrieved context):
    "You are conducting a clinical history. The patient reports
    chest pain. Based on the following clinical protocols:
    [SOCRATES framework], [ACS red flags], [differential list]

    Generate the NEXT most clinically relevant question to ask.
    If any red flags are triggered, output: EMERGENCY_TRIAGE.

    Current history so far: {accumulated_history}
    Ask ONE question. Keep it simple for a layperson."
    │
    ▼
LLM Output: "When did the chest pain start? Was it sudden or gradual?"
    │
    ▼
Translated back to patient's language → TTS → Patient hears question
```

**Knowledge Sources Embedded in RAG:**

| Source | Content | Chunk Strategy |
|--------|---------|---------------|
| **ICMR Standard Treatment Guidelines** | 500+ condition protocols | Per-condition chapters |
| **StatPearls (NCBI)** | 9,000+ clinical summaries | Per-section (History, Exam, DDx) |
| **WHO Clinical Guidelines** | Pediatric, tropical, emergency | Per-protocol |
| **Charaka Samhita (digitized)** | Dashavidha Pariksha, Nidana Panchaka | Per-Pariksha parameter |
| **Ayurvedic Pharmacopoeia of India** | Herbal drug monographs | Per-drug entry |
| **SNOMED CT** | 350,000+ clinical concepts | Concept + relationships |
| **Indian National Formulary** | Drug names, dosages, interactions | Per-drug entry |
| **SOCRATES/OPQRST Frameworks** | Clinical questioning protocols | Per-symptom-system |

---

### Q5: What is our USP?

**6 Unique Selling Propositions (detailed in PPT document):**

1. **Voice-First Zero-Literacy Design** — Usable by illiterate, elderly, rural patients with zero training
2. **RAG-Powered Adaptive Clinical Questioning** — Industry-first: LLM + medical knowledge retrieval for dynamic, physician-quality history elicitation
3. **Dual Allopathic + AYUSH Mode** — World's first platform supporting both allopathic (SOCRATES, ROS) AND Ayurvedic (Dashavidha Pariksha)
4. **Medical Document AI Pipeline** — Handwritten prescription OCR + entity extraction + chronological timeline + drug interaction flagging
5. **India-Stack Native** — Built on ABDM/ABHA/Bhashini from day one, not retrofitted
6. **Offline-First Edge-Deployable** — Full AI stack runs on a ₹15,000 mini-PC with zero internet

---

## 2. System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (PWA)                                │
│                                                                             │
│  Next.js 15 + React 19 + TypeScript + Tailwind CSS                          │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│  │ Voice UI     │ │ Touch UI     │ │ Document     │ │ Language & Consent  │ │
│  │ WebRTC Mic   │ │ Icon-driven  │ │ Camera/Upload│ │ Selector            │ │
│  │ Audio Player │ │ Tap-to-answer│ │ Preview      │ │ Audio-guided        │ │
│  │ Waveform Viz │ │ MCQ Options  │ │ Crop/Rotate  │ │ ABHA QR Scanner     │ │
│  └──────┬──────┘ └──────┬───────┘ └──────┬───────┘ └──────────┬──────────┘ │
│         └────────────────┴───────────────┴────────────────────┘             │
│                                    │                                        │
│                        WebSocket (wss://) + REST (https://)                  │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                           API GATEWAY (nginx / Traefik)                     │
│                    Rate Limiting · JWT Auth · Request Routing                │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                        BACKEND SERVICES LAYER                               │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ Session Service   │  │ History Service   │  │ Document Service         │   │
│  │ (Node.js/Express) │  │ (FastAPI/Python)  │  │ (FastAPI/Python)         │   │
│  │                   │  │                   │  │                          │   │
│  │ • Auth/Login      │  │ • Dialog Manager  │  │ • OCR Pipeline           │   │
│  │ • Session Mgmt    │  │ • Voice Pipeline  │  │ • Entity Extraction      │   │
│  │ • Consent Engine  │  │ • LLM + RAG       │  │ • Timeline Builder       │   │
│  │ • Language Prefs  │  │ • Red-flag Detect  │  │ • Drug Interaction Check │   │
│  └────────┬─────────┘  └────────┬──────────┘  └────────────┬─────────────┘   │
│           │                     │                           │                │
│  ┌────────┴─────────────────────┴───────────────────────────┴──────────┐     │
│  │                     Summary Service (FastAPI/Python)                │     │
│  │  • Synthesize history + documents into clinical summary            │     │
│  │  • FHIR R4 Bundle formatter (NRCeS profiles)                      │     │
│  │  • Physician dashboard API                                         │     │
│  └────────────────────────────────┬───────────────────────────────────┘     │
│                                   │                                         │
│  ┌────────────────────────────────┴───────────────────────────────────┐     │
│  │                     ABDM Bridge Service (Node.js)                  │     │
│  │  • ABHA V3 Auth APIs          • Fidelius E2E Encryption           │     │
│  │  • HIP Registration           • Care Context Management           │     │
│  │  • Consent Callbacks          • FHIR Bundle Push                  │     │
│  │  • HIS/EMR Connector (OpenHIM)                                    │     │
│  └───────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                     │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ PostgreSQL   │  │ Redis        │  │ ChromaDB/    │  │ MinIO/S3     │ │
│  │              │  │              │  │ Qdrant       │  │              │ │
│  │ • Sessions   │  │ • Session    │  │              │  │ • Scanned    │ │
│  │ • Patients   │  │   cache      │  │ • Medical KB │  │   documents  │ │
│  │ • Histories  │  │ • Dialog     │  │   embeddings │  │ • Audio      │ │
│  │ • Documents  │  │   state      │  │ • SNOMED CT  │  │   recordings │ │
│  │ • Consents   │  │ • Rate limit │  │ • ICD-10     │  │ • FHIR       │ │
│  │ • Audit logs │  │ • Pub/Sub    │  │ • Guidelines │  │   bundles    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                 │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Bhashini     │  │ LLM Provider │  │ Azure Doc    │  │ ABDM Gateway │ │
│  │ ULCA APIs    │  │ (OpenAI /    │  │ Intelligence │  │              │ │
│  │              │  │  Gemini /    │  │ / Google     │  │ • ABHA APIs  │ │
│  │ • ASR        │  │  Claude)     │  │ Cloud Vision │  │ • HIE-CM     │ │
│  │ • NMT        │  │              │  │              │  │ • FHIR Push  │ │
│  │ • TTS        │  │ • Chat       │  │ • OCR        │  │ • Consent    │ │
│  │              │  │ • Embeddings │  │ • Layout     │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
medikiosk/
├── apps/
│   ├── web/                          # Next.js 15 PWA (Patient + Physician UI)
│   │   ├── app/
│   │   │   ├── (patient)/            # Patient-facing routes
│   │   │   │   ├── page.tsx          # Landing / language selector
│   │   │   │   ├── login/page.tsx    # ABHA/Aadhaar login
│   │   │   │   ├── consent/page.tsx  # Audio-guided consent
│   │   │   │   ├── history/page.tsx  # Voice + touch history interview
│   │   │   │   ├── scan/page.tsx     # Document upload & scanning
│   │   │   │   ├── summary/page.tsx  # Review & confirm summary
│   │   │   │   └── complete/page.tsx # Completion + token display
│   │   │   ├── (physician)/          # Physician-facing routes
│   │   │   │   ├── dashboard/page.tsx    # Patient queue + summaries
│   │   │   │   ├── review/[id]/page.tsx  # Review/edit patient summary
│   │   │   │   └── settings/page.tsx     # Preferences
│   │   │   ├── api/                  # Next.js API routes (BFF)
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # Base UI components (shadcn/ui)
│   │   │   ├── voice/                # Voice recording, waveform, playback
│   │   │   ├── history/              # History interview flow components
│   │   │   ├── scanner/              # Document camera/upload components
│   │   │   └── consent/              # Consent flow components
│   │   ├── hooks/
│   │   │   ├── useVoiceRecorder.ts
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useBhashiniTTS.ts
│   │   │   └── useABHAAuth.ts
│   │   ├── lib/
│   │   │   ├── audio-utils.ts        # Opus encoding, VAD, noise reduction
│   │   │   └── qr-scanner.ts         # ABHA QR code parsing
│   │   └── public/
│   │       ├── icons/                # Medical/action icons (SVG)
│   │       ├── audio/                # Pre-recorded consent audio (22 langs)
│   │       └── manifest.json         # PWA manifest
│   │
│   └── physician-app/               # (Optional) Separate physician PWA
│
├── services/
│   ├── session-service/              # Node.js — Auth, sessions, consent
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   │   ├── abha-auth.service.ts
│   │   │   │   ├── consent.service.ts
│   │   │   │   └── session.service.ts
│   │   │   ├── middleware/
│   │   │   └── routes/
│   │   └── Dockerfile
│   │
│   ├── history-service/              # FastAPI Python — Voice AI + Dialog + RAG
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── voice.py          # WebSocket voice streaming endpoint
│   │   │   │   └── history.py        # REST history CRUD
│   │   │   ├── core/
│   │   │   │   ├── dialog_manager.py # Clinical dialog state machine
│   │   │   │   ├── bhashini.py       # Bhashini ASR/NMT/TTS client
│   │   │   │   ├── llm_engine.py     # LLM + RAG query engine
│   │   │   │   ├── red_flag.py       # Emergency symptom detector
│   │   │   │   └── ayush_mode.py     # Dashavidha Pariksha interview logic
│   │   │   ├── rag/
│   │   │   │   ├── embedder.py       # Document embedding pipeline
│   │   │   │   ├── retriever.py      # Vector search + BM25 hybrid
│   │   │   │   └── knowledge_base.py # SNOMED CT, ICMR STGs, Charaka loader
│   │   │   └── models/
│   │   │       ├── history.py        # Pydantic models for clinical history
│   │   │       └── dialog_state.py   # Conversation state model
│   │   └── Dockerfile
│   │
│   ├── document-service/             # FastAPI Python — OCR + Document AI
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   └── documents.py      # Upload, process, retrieve
│   │   │   ├── core/
│   │   │   │   ├── ocr_engine.py     # Azure/Google/Local OCR
│   │   │   │   ├── entity_extractor.py   # LLM-based medical entity extraction
│   │   │   │   ├── timeline_builder.py   # Chronological document ordering
│   │   │   │   └── drug_interaction.py   # Drug-drug interaction checker
│   │   │   └── models/
│   │   └── Dockerfile
│   │
│   ├── summary-service/              # FastAPI Python — Summary generation + FHIR
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── summarizer.py     # LLM summary generator
│   │   │   │   ├── fhir_formatter.py # FHIR R4 Bundle builder (NRCeS)
│   │   │   │   └── ayush_formatter.py # Dashavidha Pariksha structured output
│   │   │   └── models/
│   │   └── Dockerfile
│   │
│   └── abdm-bridge/                  # Node.js — ABDM HIP/HIU integration
│       ├── src/
│       │   ├── hip/                   # Health Information Provider endpoints
│       │   │   ├── discovery.ts       # Patient discovery callbacks
│       │   │   ├── linking.ts         # Care context linking
│       │   │   └── data-push.ts       # Encrypted FHIR data transfer
│       │   ├── hiu/                   # Health Information User (pull records)
│       │   ├── fidelius/              # E2E encryption (Curve25519 + AES-GCM)
│       │   └── his-connector/         # HIS/EMR integration adapters
│       └── Dockerfile
│
├── packages/
│   ├── shared-types/                 # TypeScript type definitions
│   ├── fhir-models/                  # FHIR R4 resource type definitions
│   └── ui-icons/                     # Medical icon library (SVG)
│
├── rag-data/
│   ├── icmr-stgs/                    # ICMR Standard Treatment Guidelines
│   ├── statpearls/                   # StatPearls clinical summaries
│   ├── charaka-samhita/              # Digitized Ayurvedic text
│   ├── snomed-ct/                    # SNOMED CT concept files
│   └── drug-database/                # Indian National Formulary
│
├── infra/
│   ├── docker-compose.yml            # Local development stack
│   ├── docker-compose.prod.yml       # Production stack
│   ├── k8s/                          # Kubernetes manifests
│   └── terraform/                    # Cloud infrastructure
│
├── .env.example
├── turbo.json                        # Turborepo config
└── package.json
```

---

## 3. Iterative Development Phases

### Phase 0 — UI Foundation & Deployment (Week 1-2) — *SIH DEMO*
- [ ] Project scaffolding (Next.js 15 + Tailwind + PWA)
- [ ] Patient flow UI (5 screens: Language → Login → Consent → History → Summary)
- [ ] Clean white minimal design system
- [ ] Icon library for medical concepts
- [ ] Static mock data for demo flow
- [ ] Deploy to Vercel/Railway

### Phase 1 — Module A: Conversational History Engine (Week 3-4)
- [ ] Bhashini ASR/TTS/NMT integration
- [ ] WebSocket voice streaming
- [ ] Basic dialog manager (static question flow)
- [ ] Voice + touch dual input
- [ ] Hindi + English + 2 regional languages

### Phase 2 — Module B: Document OCR & Intelligence (Week 5-6)
- [ ] Document upload/camera capture UI
- [ ] OCR integration (Azure Document Intelligence)
- [ ] Medical entity extraction (LLM-based)
- [ ] Chronological timeline builder
- [ ] Abnormal value highlighting

### Phase 3 — Module C: Summary Generator + Physician Dashboard (Week 7-8)
- [ ] LLM-based clinical summary synthesis
- [ ] Standard clinical format output (CC → HPI → PMH → Drug → Family → ROS)
- [ ] AYUSH Dashavidha Pariksha format
- [ ] Physician review/edit dashboard
- [ ] PDF/print summary generation

### Phase 4 — Module D: ABDM/ABHA Integration (Week 9-10)
- [ ] ABHA V3 auth flow (OTP + Scan & Share)
- [ ] FHIR R4 Bundle generation (NRCeS profiles)
- [ ] HIP registration with ABDM sandbox
- [ ] Care context creation
- [ ] HIS connector (OpenHIM)

### Phase 5 — RAG + AYUSH + Edge + Hardening (Week 11-12)
- [ ] RAG knowledge base ingestion (ICMR, StatPearls, Charaka Samhita)
- [ ] Adaptive questioning engine (LLM + RAG)
- [ ] Red-flag emergency triage system
- [ ] Edge/offline deployment (Sherpa-onnx + CTranslate2)
- [ ] Security hardening (DPDP compliance)
- [ ] Load testing (5000 concurrent sessions)

---

## 4. Phase 0 — UI Foundation & Deployment

### Design System

```
DESIGN TOKENS:
  Colors:
    --primary:    #FFFFFF (White)
    --accent:     #2563EB (Blue-600)
    --accent-light: #EFF6FF (Blue-50)
    --success:    #16A34A (Green-600)
    --warning:    #F59E0B (Amber-500)
    --error:      #DC2626 (Red-600)
    --text:       #1F2937 (Gray-800)
    --text-muted: #6B7280 (Gray-500)
    --bg:         #FFFFFF
    --bg-subtle:  #F9FAFB (Gray-50)

  Typography:
    --font-primary: 'Inter', system-ui, sans-serif
    --font-display: 'Plus Jakarta Sans', sans-serif
    --text-hero:    48px / bold
    --text-heading:  24px / semibold
    --text-body:    18px / regular  (larger for elderly readability)
    --text-caption: 14px / medium

  Spacing:
    --space-xs:  8px
    --space-sm: 16px
    --space-md: 24px
    --space-lg: 32px
    --space-xl: 48px

  Border Radius:
    --radius-sm:  8px
    --radius-md: 12px
    --radius-lg: 16px
    --radius-xl: 24px

  Shadows:
    --shadow-card: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)
    --shadow-elevated: 0 10px 15px -3px rgba(0,0,0,0.1)
```

### Screen Flow (Patient Journey)

```
┌─────────────────────────────────────────────────┐
│ SCREEN 1: LANGUAGE SELECTOR                      │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │         🏥 MediKiosk                        │ │
│  │                                             │ │
│  │    अपनी भाषा चुनें / Choose Your Language   │ │
│  │                                             │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐    │ │
│  │  │  हिंदी   │  │ English │  │  தமிழ்   │    │ │
│  │  └─────────┘  └─────────┘  └─────────┘    │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐    │ │
│  │  │  తెలుగు  │  │  বাংলা   │  │  मराठी   │    │ │
│  │  └─────────┘  └─────────┘  └─────────┘    │ │
│  │                                             │ │
│  │  [🔊 Audio: "Apni bhasha chunein"]          │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ SCREEN 2: LOGIN (ABHA / Aadhaar)                 │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  ← Back                                     │ │
│  │                                             │ │
│  │        👤 अपनी पहचान बताएं                   │ │
│  │        Identify Yourself                     │ │
│  │                                             │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │  📱 ABHA ID से लॉगिन                  │  │ │
│  │  │     Login with ABHA ID                 │  │ │
│  │  └───────────────────────────────────────┘  │ │
│  │                                             │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │  📷 QR Code स्कैन करें                │  │ │
│  │  │     Scan QR Code                       │  │ │
│  │  └───────────────────────────────────────┘  │ │
│  │                                             │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │  🆕 नया ABHA बनाएं                    │  │ │
│  │  │     Create New ABHA                    │  │ │
│  │  └───────────────────────────────────────┘  │ │
│  │                                             │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │  👤 बिना ABHA के आगे बढ़ें             │  │ │
│  │  │     Continue without ABHA              │  │ │
│  │  └───────────────────────────────────────┘  │ │
│  │                                             │ │
│  │  [🔊 Audio guidance playing...]             │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ SCREEN 3: CONSENT (Audio-Guided)                 │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  ← Back                                     │ │
│  │                                             │ │
│  │        🔒 आपकी सहमति                        │ │
│  │        Your Consent                          │ │
│  │                                             │ │
│  │  [🔊 Audio explaining consent in patient's   │ │
│  │       language — auto-playing]               │ │
│  │                                             │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │ ✅ मैं अपनी बीमारी का इतिहास बताने     │  │ │
│  │  │    के लिए सहमत हूं                     │  │ │
│  │  │    I agree to share my medical history  │  │ │
│  │  └───────────────────────────────────────┘  │ │
│  │                                             │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │ ✅ मैं डॉक्टर के साथ साझा करने के     │  │ │
│  │  │    लिए सहमत हूं                        │  │ │
│  │  └───────────────────────────────────────┘  │ │
│  │                                             │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │ ☐  ABHA रिकॉर्ड में सेव करें (Optional)│  │ │
│  │  └───────────────────────────────────────┘  │ │
│  │                                             │ │
│  │      [ ✅ सहमत हूं — आगे बढ़ें ]            │ │
│  │      [    I Agree — Proceed    ]             │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ SCREEN 4: HISTORY INTERVIEW (Voice + Touch)      │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Step 1 of 6           ████░░░░░░ 16%       │ │
│  │                                             │ │
│  │  🩺 आपको क्या तकलीफ है?                     │ │
│  │     What is your main problem?              │ │
│  │                                             │ │
│  │  [🔊 Question played as audio]              │ │
│  │                                             │ │
│  │  ┌─── VOICE MODE ─────────────────────┐     │ │
│  │  │                                     │     │ │
│  │  │      🎤  बोलें / Speak              │     │ │
│  │  │      [~~~waveform animation~~~]     │     │ │
│  │  │                                     │     │ │
│  │  └─────────────────────────────────────┘     │ │
│  │                                             │ │
│  │  ── या / OR ──                              │ │
│  │                                             │ │
│  │  ┌─── TOUCH MODE ─────────────────────┐     │ │
│  │  │  🤒 बुखार / Fever                   │     │ │
│  │  │  🤕 सिरदर्द / Headache              │     │ │
│  │  │  💔 सीने में दर्द / Chest Pain       │     │ │
│  │  │  🤢 पेट दर्द / Stomach Pain         │     │ │
│  │  │  😮‍💨 सांस की तकलीफ / Breathing      │     │ │
│  │  │  📝 अन्य / Other...                 │     │ │
│  │  └─────────────────────────────────────┘     │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ SCREEN 5: DOCUMENT SCAN                          │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Step 5 of 6           ████████░░ 83%       │ │
│  │                                             │ │
│  │  📄 अपने पुराने कागजात अपलोड करें           │ │
│  │     Upload your old medical documents       │ │
│  │                                             │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │  📷  फोटो लें / Take Photo            │  │ │
│  │  └───────────────────────────────────────┘  │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │  📁  गैलरी से चुनें / Choose from Files│  │ │
│  │  └───────────────────────────────────────┘  │ │
│  │                                             │ │
│  │  Uploaded Documents:                        │ │
│  │  ┌──────┐  ┌──────┐  ┌──────┐              │ │
│  │  │ 📄   │  │ 📄   │  │  +   │              │ │
│  │  │ Rx   │  │ Lab  │  │ Add  │              │ │
│  │  │ ✅   │  │ ⏳   │  │ More │              │ │
│  │  └──────┘  └──────┘  └──────┘              │ │
│  │                                             │ │
│  │  [ ⏭️ स्किप करें ]  [ ✅ आगे बढ़ें ]        │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 5. Module A — Conversational Multimodal History Engine

### Dialog Manager State Machine

```python
# services/history-service/app/core/dialog_manager.py
from enum import Enum
from pydantic import BaseModel
from typing import List, Optional

class HistorySection(str, Enum):
    CHIEF_COMPLAINT = "chief_complaint"
    HPI = "history_of_present_illness"
    PAST_MEDICAL = "past_medical_history"
    PAST_SURGICAL = "past_surgical_history"
    DRUG_HISTORY = "drug_history"
    ALLERGY = "allergy_history"
    FAMILY_HISTORY = "family_history"
    PERSONAL_HISTORY = "personal_history"
    REVIEW_OF_SYSTEMS = "review_of_systems"
    # AYUSH-specific
    PRAKRITI = "prakriti_assessment"
    VIKRITI = "vikriti_assessment"
    AGNI = "agni_assessment"
    KOSHTHA = "koshtha_assessment"
    AHARA_VIHARA = "ahara_vihara"
    DASHAVIDHA = "dashavidha_pariksha"

class DialogState(BaseModel):
    session_id: str
    patient_id: str
    language: str                          # ISO 639-1 code
    mode: str = "allopathic"               # "allopathic" | "ayush" | "integrated"
    current_section: HistorySection = HistorySection.CHIEF_COMPLAINT
    questions_asked: List[dict] = []       # [{question, answer, timestamp}]
    accumulated_history: dict = {}         # structured history so far
    red_flags_detected: List[str] = []
    is_emergency: bool = False
    completion_percentage: float = 0.0

class DialogManager:
    """
    Orchestrates the clinical history interview.
    Uses LLM + RAG for adaptive questioning.
    Falls back to structured question templates when offline.
    """

    SECTION_ORDER_ALLOPATHIC = [
        HistorySection.CHIEF_COMPLAINT,
        HistorySection.HPI,
        HistorySection.PAST_MEDICAL,
        HistorySection.PAST_SURGICAL,
        HistorySection.DRUG_HISTORY,
        HistorySection.ALLERGY,
        HistorySection.FAMILY_HISTORY,
        HistorySection.PERSONAL_HISTORY,
        HistorySection.REVIEW_OF_SYSTEMS,
    ]

    SECTION_ORDER_AYUSH = SECTION_ORDER_ALLOPATHIC + [
        HistorySection.PRAKRITI,
        HistorySection.VIKRITI,
        HistorySection.AGNI,
        HistorySection.KOSHTHA,
        HistorySection.AHARA_VIHARA,
    ]

    RED_FLAG_SYMPTOMS = {
        "chest_pain_acute": ["chest pain", "seene mein dard", "छाती में दर्द"],
        "stroke_signs": ["weakness one side", "slurred speech", "sudden confusion"],
        "breathing_severe": ["cannot breathe", "saans nahi aa rahi", "साँस नहीं"],
        "unconscious": ["fainted", "behosh", "बेहोश"],
        "severe_bleeding": ["bleeding heavily", "khoon", "खून बह रहा"],
    }

    async def generate_next_question(
        self, state: DialogState, patient_response: str
    ) -> dict:
        """
        Generate the next clinical question using LLM + RAG.
        Returns: {question_text, touch_options[], section, is_emergency}
        """
        # 1. Check for red flags
        emergency = self._check_red_flags(patient_response)
        if emergency:
            return {
                "question_text": None,
                "is_emergency": True,
                "red_flag": emergency,
                "action": "PRIORITY_TRIAGE_ALERT"
            }

        # 2. Update accumulated history
        state.accumulated_history[state.current_section.value] = (
            state.accumulated_history.get(state.current_section.value, "")
            + f"\n{patient_response}"
        )

        # 3. Query RAG for relevant clinical protocols
        rag_context = await self.rag_engine.retrieve(
            query=f"{state.current_section.value}: {patient_response}",
            filters={"mode": state.mode}
        )

        # 4. Generate next question via LLM
        prompt = self._build_question_prompt(state, patient_response, rag_context)
        llm_response = await self.llm_engine.generate(prompt)

        # 5. Parse LLM output
        next_question = llm_response["question"]
        touch_options = llm_response.get("options", [])
        should_advance = llm_response.get("section_complete", False)

        if should_advance:
            state.current_section = self._next_section(state)

        return {
            "question_text": next_question,
            "touch_options": touch_options,
            "section": state.current_section.value,
            "is_emergency": False,
            "progress": self._calc_progress(state)
        }

    def _build_question_prompt(self, state, response, rag_context):
        return f"""You are a clinical history-taking assistant conducting a structured
medical interview. You are currently in the {state.current_section.value} section.

CLINICAL PROTOCOLS (Retrieved from knowledge base):
{rag_context}

HISTORY CAPTURED SO FAR:
{json.dumps(state.accumulated_history, indent=2)}

PATIENT'S LATEST RESPONSE: "{response}"

INSTRUCTIONS:
1. Based on the clinical protocols and history so far, generate the NEXT
   most clinically relevant question to ask the patient.
2. Keep the question simple, in layperson terms (the patient may be illiterate).
3. If this section is complete, set "section_complete": true.
4. Provide 4-6 touch-friendly multiple choice options when possible.
5. If you detect ANY emergency red flags, set "is_emergency": true.

OUTPUT FORMAT (JSON):
{{
  "question": "Your next question in simple language",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "section_complete": false,
  "clinical_reasoning": "Brief note on why this question matters"
}}"""
```

### WebSocket Voice Streaming Endpoint

```python
# services/history-service/app/api/voice.py
from fastapi import WebSocket, WebSocketDisconnect
import asyncio

class VoiceSessionManager:
    """
    Manages real-time voice conversation over WebSocket.
    Implements sentence-streaming cascade for low latency.
    """

    async def handle_session(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        state = await self.load_or_create_state(session_id)
        bhashini = BhashiniVoiceService()

        # Send initial greeting in patient's language
        greeting = await self._get_greeting(state.language)
        greeting_audio = await bhashini.text_to_speech(greeting, state.language)
        await websocket.send_json({
            "type": "tts_audio",
            "audio": greeting_audio,
            "text": greeting
        })

        try:
            while True:
                # Receive audio chunk from client
                data = await websocket.receive_bytes()

                # ASR: Speech → Text (in patient's language)
                transcript = await bhashini.speech_to_text(
                    audio_base64=base64.b64encode(data).decode(),
                    lang=state.language
                )

                # Translate to English for LLM processing (if not English)
                english_text = transcript
                if state.language != 'en':
                    english_text = await bhashini.translate(
                        transcript, state.language, 'en'
                    )

                # Generate next question via Dialog Manager + RAG
                result = await self.dialog_manager.generate_next_question(
                    state, english_text
                )

                if result["is_emergency"]:
                    await self._trigger_emergency(websocket, state, result)
                    break

                # Translate question back to patient's language
                question_native = result["question_text"]
                if state.language != 'en':
                    question_native = await bhashini.translate(
                        result["question_text"], 'en', state.language
                    )

                # TTS: Generate audio response
                question_audio = await bhashini.text_to_speech(
                    question_native, state.language
                )

                # Translate touch options
                native_options = []
                for opt in result.get("touch_options", []):
                    if state.language != 'en':
                        native_opt = await bhashini.translate(opt, 'en', state.language)
                        native_options.append(native_opt)
                    else:
                        native_options.append(opt)

                # Send response to client
                await websocket.send_json({
                    "type": "question",
                    "audio": question_audio,
                    "text": question_native,
                    "text_en": result["question_text"],
                    "options": native_options,
                    "section": result["section"],
                    "progress": result["progress"]
                })

                # Save state
                await self.save_state(state)

        except WebSocketDisconnect:
            await self.save_state(state)
```

---

## 6. Module B — Medical Document Digitization & Intelligence

### OCR + Entity Extraction Pipeline

```python
# services/document-service/app/core/ocr_engine.py
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential

class MedicalDocumentProcessor:
    """
    End-to-end pipeline: Image → OCR → Entity Extraction → Structured Data
    """

    def __init__(self):
        self.doc_client = DocumentIntelligenceClient(
            endpoint=os.environ["AZURE_DOC_ENDPOINT"],
            credential=AzureKeyCredential(os.environ["AZURE_DOC_KEY"])
        )

    async def process_document(self, image_bytes: bytes, doc_type: str) -> dict:
        """
        Process a medical document image.
        doc_type: "prescription" | "lab_report" | "discharge_summary"
        """
        # Step 1: OCR — Extract raw text + layout
        ocr_result = await self._run_ocr(image_bytes)

        # Step 2: LLM-based medical entity extraction
        entities = await self._extract_entities(ocr_result.text, doc_type)

        # Step 3: Map to standard codes (SNOMED CT, ICD-10)
        coded_entities = await self._map_to_codes(entities)

        # Step 4: Check for abnormal values
        flags = self._flag_abnormals(coded_entities)

        # Step 5: Check drug interactions
        interactions = await self._check_drug_interactions(coded_entities)

        return {
            "raw_text": ocr_result.text,
            "doc_type": doc_type,
            "extracted_date": entities.get("date"),
            "entities": coded_entities,
            "abnormal_flags": flags,
            "drug_interactions": interactions,
            "confidence": ocr_result.confidence
        }

    async def _extract_entities(self, ocr_text: str, doc_type: str) -> dict:
        """Use Vision-LLM to extract structured clinical entities."""
        prompt = f"""You are a medical document parser specialized in Indian prescriptions and reports.

DOCUMENT TYPE: {doc_type}
OCR TEXT:
{ocr_text}

Extract the following structured information:
{{
  "date": "YYYY-MM-DD or null",
  "doctor_name": "string or null",
  "hospital": "string or null",
  "diagnoses": [
    {{"name": "...", "icd10_code": "..."}}
  ],
  "medications": [
    {{
      "drug_name": "...",
      "dosage": "...",
      "frequency": "OD/BD/TDS/QID/SOS",
      "duration": "...",
      "route": "oral/topical/IV"
    }}
  ],
  "investigations": [
    {{
      "test_name": "...",
      "value": "...",
      "unit": "...",
      "reference_range": "...",
      "is_abnormal": true/false
    }}
  ],
  "procedures": ["..."],
  "allergies_mentioned": ["..."]
}}

RULES:
- For handwriting errors, use medical context to correct (e.g., "Amoxycillin" → "Amoxicillin")
- Expand abbreviations: Tab=Tablet, Cap=Capsule, Syp=Syrup, OD=Once Daily, BD=Twice Daily
- If value cannot be determined, use null
- Return valid JSON only"""

        response = await self.llm.generate(prompt)
        return json.loads(response)
```

---

## 7. Module C — Structured History Summary Generator

### Clinical Summary Synthesis

```python
# services/summary-service/app/core/summarizer.py

class ClinicalSummarizer:
    """
    Synthesizes voice history + scanned documents into
    a physician-ready clinical summary in standard format.
    """

    async def generate_summary(
        self,
        dialog_history: dict,          # From Module A
        processed_documents: list,      # From Module B
        mode: str = "allopathic"        # "allopathic" | "ayush" | "integrated"
    ) -> ClinicalSummary:

        prompt = f"""You are a senior medical resident generating a clinical summary
from a patient's self-reported history and prior medical documents.

MODE: {mode}

PATIENT-REPORTED HISTORY (from voice/touch interview):
{json.dumps(dialog_history, indent=2)}

PRIOR MEDICAL DOCUMENTS (OCR-extracted):
{json.dumps([doc for doc in processed_documents], indent=2)}

Generate a structured clinical summary in the following format:

## CLINICAL HISTORY SUMMARY

**Chief Complaint(s):** [primary presenting complaint with duration]

**History of Present Illness:**
[Detailed narrative of the current illness in chronological order.
Include onset, progression, associated symptoms, aggravating/relieving factors]

**Past Medical History:**
[Chronic conditions, hospitalizations, significant past illnesses]

**Past Surgical History:**
[Prior surgeries with dates]

**Drug History:**
[Current medications with dosages and frequency]

**Allergy History:**
[Known drug/food allergies and reaction type]

**Family History:**
[Relevant family medical history]

**Personal History:**
[Smoking, alcohol, diet, sleep, exercise habits]

**Review of Systems:**
[Brief system-wise review: CVS, RS, GIT, CNS, MSK, GUS]

{"**AYUSH ASSESSMENT (Dashavidha Pariksha):**" if mode in ["ayush", "integrated"] else ""}
{"Prakriti, Vikriti, Sara, Samhanana, Pramana, Satmya, Sattva, Ahara Shakti, Vyayama Shakti, Vaya" if mode in ["ayush", "integrated"] else ""}

**Prior Investigations Summary:**
[Chronological list of prior lab/imaging results with abnormals highlighted]

**Medications Timeline:**
[Chronological list of past and current medications]

**⚠️ ALERTS:**
[Abnormal lab values, potential drug interactions, red flags]

RULES:
- This is a DRAFT for physician review — clearly state it
- Mark uncertain information with [PATIENT-REPORTED - UNVERIFIED]
- Highlight abnormal values in bold
- Use standard medical terminology
- Keep it concise but complete"""

        summary_text = await self.llm.generate(prompt)

        return ClinicalSummary(
            text=summary_text,
            mode=mode,
            generated_at=datetime.utcnow(),
            status="draft",  # Always draft until physician confirms
            fhir_bundle=await self.fhir_formatter.to_bundle(summary_text, dialog_history)
        )
```

---

## 8. Module D — Consent, Privacy & ABDM Integration

### FHIR R4 Bundle Builder (NRCeS Profile)

```typescript
// services/abdm-bridge/src/hip/fhir-builder.ts

interface FHIRBundleInput {
  patient: { abhaNumber: string; name: string; gender: string; dob: string };
  encounter: { date: string; facilityId: string; practitionerId?: string };
  conditions: Array<{ name: string; snomedCode: string }>;
  observations: Array<{ name: string; loincCode: string; value: string; unit: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  allergies: string[];
  summaryText: string;
}

function buildOPConsultBundle(input: FHIRBundleInput): object {
  const bundleId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  return {
    resourceType: "Bundle",
    id: bundleId,
    meta: {
      versionId: "1",
      lastUpdated: timestamp,
      profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord"]
    },
    type: "document",
    timestamp,
    entry: [
      // 1. Composition (Required first entry)
      {
        fullUrl: `urn:uuid:composition-${bundleId}`,
        resource: {
          resourceType: "Composition",
          status: "final",
          type: {
            coding: [{
              system: "http://snomed.info/sct",
              code: "371530004",
              display: "Clinical consultation report"
            }]
          },
          subject: { reference: `urn:uuid:patient-${bundleId}` },
          date: timestamp,
          title: "MediKiosk OPD Clinical History Summary",
          section: [
            {
              title: "Chief Complaints",
              entry: input.conditions.map((_, i) =>
                ({ reference: `urn:uuid:condition-${i}-${bundleId}` })
              )
            },
            {
              title: "Clinical Summary",
              text: { status: "generated", div: `<div>${input.summaryText}</div>` }
            }
          ]
        }
      },
      // 2. Patient (ABHA-linked)
      {
        fullUrl: `urn:uuid:patient-${bundleId}`,
        resource: {
          resourceType: "Patient",
          identifier: [{
            system: "https://healthid.abdm.gov.in",
            value: input.patient.abhaNumber
          }],
          name: [{ text: input.patient.name }],
          gender: input.patient.gender,
          birthDate: input.patient.dob
        }
      },
      // 3. Conditions (from history + documents)
      ...input.conditions.map((cond, i) => ({
        fullUrl: `urn:uuid:condition-${i}-${bundleId}`,
        resource: {
          resourceType: "Condition",
          code: {
            coding: [{
              system: "http://snomed.info/sct",
              code: cond.snomedCode,
              display: cond.name
            }]
          },
          subject: { reference: `urn:uuid:patient-${bundleId}` }
        }
      })),
      // 4. Observations (symptoms, vitals, AYUSH params)
      ...input.observations.map((obs, i) => ({
        fullUrl: `urn:uuid:observation-${i}-${bundleId}`,
        resource: {
          resourceType: "Observation",
          code: {
            coding: [{
              system: "http://loinc.org",
              code: obs.loincCode,
              display: obs.name
            }]
          },
          valueQuantity: { value: parseFloat(obs.value), unit: obs.unit },
          subject: { reference: `urn:uuid:patient-${bundleId}` }
        }
      }))
    ]
  };
}
```

---

## 9. RAG Engine — Clinical Knowledge Pipeline

### Knowledge Ingestion & Embedding

```python
# services/history-service/app/rag/knowledge_base.py
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

class ClinicalKnowledgeBase:
    """
    Ingests medical knowledge sources and creates vector embeddings
    for RAG-powered clinical questioning.
    """

    def __init__(self):
        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
        self.vector_store = Chroma(
            persist_directory="./rag_db",
            embedding_function=self.embeddings,
            collection_name="clinical_knowledge"
        )
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", " "]
        )

    async def ingest_icmr_guidelines(self, pdf_path: str):
        """Ingest ICMR Standard Treatment Guidelines."""
        docs = self._load_pdf(pdf_path)
        chunks = self.splitter.split_documents(docs)
        for chunk in chunks:
            chunk.metadata["source"] = "ICMR_STG"
            chunk.metadata["type"] = "clinical_protocol"
        self.vector_store.add_documents(chunks)

    async def ingest_charaka_samhita(self, text_path: str):
        """Ingest digitized Charaka Samhita for AYUSH mode."""
        docs = self._load_text(text_path)
        chunks = self.splitter.split_documents(docs)
        for chunk in chunks:
            chunk.metadata["source"] = "Charaka_Samhita"
            chunk.metadata["type"] = "ayush_protocol"
            chunk.metadata["mode"] = "ayush"
        self.vector_store.add_documents(chunks)

    async def ingest_snomed_ct(self, rf2_path: str):
        """Ingest SNOMED CT concepts for clinical terminology."""
        # Parse RF2 format, create concept-definition pairs
        concepts = self._parse_snomed_rf2(rf2_path)
        docs = [
            Document(
                page_content=f"{c['term']}: {c['definition']}",
                metadata={"source": "SNOMED_CT", "concept_id": c['id'], "type": "terminology"}
            )
            for c in concepts
        ]
        self.vector_store.add_documents(docs)

    async def retrieve(self, query: str, filters: dict = None, k: int = 5) -> str:
        """Hybrid retrieval: vector similarity + metadata filtering."""
        results = self.vector_store.similarity_search(
            query=query,
            k=k,
            filter=filters  # e.g., {"mode": "ayush"} or {"type": "clinical_protocol"}
        )
        return "\n\n---\n\n".join([
            f"[Source: {r.metadata.get('source', 'Unknown')}]\n{r.page_content}"
            for r in results
        ])
```

---

## 10. Database Schema Design

### PostgreSQL Schema

```sql
-- Core tables for MediKiosk

-- Patient sessions
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    abha_number     VARCHAR(17),          -- 91-XXXX-XXXX-XXXX (encrypted)
    patient_name    VARCHAR(255),
    language        VARCHAR(5) NOT NULL,  -- ISO 639-1
    mode            VARCHAR(20) DEFAULT 'allopathic', -- allopathic|ayush|integrated
    department      VARCHAR(100),
    facility_id     VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'active', -- active|completed|emergency|abandoned
    consent_granted BOOLEAN DEFAULT FALSE,
    consent_details JSONB,                -- granular consent flags
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Clinical history (from voice/touch interview)
CREATE TABLE clinical_histories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
    section         VARCHAR(50) NOT NULL,  -- chief_complaint, hpi, etc.
    question_text   TEXT,
    answer_text     TEXT,
    answer_language VARCHAR(5),
    answer_english  TEXT,                  -- translated to English
    input_mode      VARCHAR(10),           -- 'voice' | 'touch'
    audio_ref       VARCHAR(500),          -- S3/MinIO path to audio
    red_flag        BOOLEAN DEFAULT FALSE,
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- Scanned/uploaded medical documents
CREATE TABLE medical_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
    doc_type        VARCHAR(30),           -- prescription|lab_report|discharge_summary
    image_ref       VARCHAR(500),          -- S3/MinIO path
    ocr_text        TEXT,
    extracted_data  JSONB,                 -- structured entities
    document_date   DATE,
    confidence      FLOAT,
    abnormal_flags  JSONB,
    drug_interactions JSONB,
    processed_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Generated clinical summaries
CREATE TABLE clinical_summaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
    summary_text    TEXT NOT NULL,
    summary_mode    VARCHAR(20),           -- allopathic|ayush|integrated
    fhir_bundle     JSONB,                 -- FHIR R4 Bundle (NRCeS)
    status          VARCHAR(20) DEFAULT 'draft', -- draft|confirmed|rejected
    physician_edits TEXT,
    confirmed_by    VARCHAR(100),          -- physician ID
    confirmed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ABDM integration records
CREATE TABLE abdm_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
    abha_number     VARCHAR(17),
    care_context_id VARCHAR(100),
    fhir_bundle_ref VARCHAR(500),          -- S3 path to encrypted bundle
    push_status     VARCHAR(20) DEFAULT 'pending', -- pending|pushed|failed
    pushed_at       TIMESTAMPTZ,
    his_push_status VARCHAR(20) DEFAULT 'pending',
    his_pushed_at   TIMESTAMPTZ
);

-- Consent audit trail (DPDP Act 2023 compliance)
CREATE TABLE consent_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id),
    abha_number     VARCHAR(17),
    consent_type    VARCHAR(50),           -- data_capture|doctor_share|abha_link
    action          VARCHAR(20),           -- granted|revoked
    ip_address      INET,
    user_agent      VARCHAR(500),
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_abha ON sessions(abha_number);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_histories_session ON clinical_histories(session_id);
CREATE INDEX idx_documents_session ON medical_documents(session_id);
CREATE INDEX idx_summaries_session ON clinical_summaries(session_id);
CREATE INDEX idx_audit_abha ON consent_audit_log(abha_number);
```

---

## 11. API Contract Specification

### REST API Endpoints

```yaml
# Session & Auth
POST   /api/v1/auth/abha/request-otp     # Request ABHA login OTP
POST   /api/v1/auth/abha/verify-otp      # Verify OTP → patient profile
POST   /api/v1/auth/abha/create           # Create new ABHA
POST   /api/v1/auth/scan-and-share        # QR-based fast auth
POST   /api/v1/sessions                    # Create new session
GET    /api/v1/sessions/:id               # Get session details
PATCH  /api/v1/sessions/:id/consent       # Update consent

# History Interview
WS     /api/v1/history/voice/:sessionId   # WebSocket voice streaming
POST   /api/v1/history/:sessionId/touch   # Submit touch-based answer
GET    /api/v1/history/:sessionId         # Get accumulated history
GET    /api/v1/history/:sessionId/progress # Get completion progress

# Document Processing
POST   /api/v1/documents/:sessionId/upload    # Upload document image
GET    /api/v1/documents/:sessionId           # Get all processed documents
GET    /api/v1/documents/:sessionId/:docId    # Get single document details
GET    /api/v1/documents/:sessionId/timeline  # Get chronological timeline

# Summary
POST   /api/v1/summary/:sessionId/generate   # Generate clinical summary
GET    /api/v1/summary/:sessionId             # Get summary
PATCH  /api/v1/summary/:sessionId/confirm     # Physician confirms summary
PATCH  /api/v1/summary/:sessionId/edit        # Physician edits summary
GET    /api/v1/summary/:sessionId/pdf         # Download PDF summary

# ABDM Integration
POST   /api/v1/abdm/:sessionId/link-abha     # Link ABHA to care context
POST   /api/v1/abdm/:sessionId/push-fhir     # Push FHIR bundle to ABDM
GET    /api/v1/abdm/:sessionId/status         # Check ABDM push status
POST   /api/v1/abdm/his/push                  # Push to HIS/EMR

# Physician Dashboard
GET    /api/v1/physician/queue                # Get patient queue
GET    /api/v1/physician/patient/:sessionId   # Get full patient data
```

---

## 12. Edge/Offline Architecture

### Offline-First Deployment Stack

```
┌──────────────────────────────────────────────────────────┐
│              EDGE DEVICE (Mini-PC / Jetson Orin Nano)     │
│                                                           │
│  ┌──────────────────────────────────────────────────┐     │
│  │ ASR: IndicConformer INT8 (Sherpa-onnx) [~180MB]  │     │
│  │ • Real-time Factor (RTF) < 0.15 on CPU           │     │
│  │ • Supports 22 Indian languages offline            │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  ┌──────────────────────────────────────────────────┐     │
│  │ NMT: IndicTrans2 INT8 (CTranslate2) [~450MB]    │     │
│  │ • 4x speedup over PyTorch                         │     │
│  │ • Direct Indic↔English translation               │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  ┌──────────────────────────────────────────────────┐     │
│  │ TTS: IndicTTS VITS (Piper ONNX) [~60MB]         │     │
│  │ • Male/Female voices per language                 │     │
│  │ • < 50MB RAM footprint                           │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  ┌──────────────────────────────────────────────────┐     │
│  │ LLM: Llama-3.2-3B-Instruct (GGUF Q4) [~2GB]    │     │
│  │ • Clinical fine-tuned with LoRA adapters          │     │
│  │ • Runs on CPU with llama.cpp                      │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  ┌──────────────────────────────────────────────────┐     │
│  │ OCR: PaddleOCR (fine-tuned on Indian medical)    │     │
│  │ • Runs on CPU                                     │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Vector DB: ChromaDB (SQLite backend) [local]     │     │
│  │ • Pre-embedded medical knowledge                  │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Audio DSP: Silero VAD + RNNoise (ONNX)           │     │
│  │ • Client-side noise reduction                     │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  Total Storage: ~3GB | RAM: 4-8GB | CPU: 4+ cores       │
│  Minimum Hardware: ₹15,000 mini-PC or tablet             │
└──────────────────────────────────────────────────────────┘
```

---

## 13. Security & Compliance Architecture

### DPDP Act 2023 Compliance Checklist

| Requirement | Implementation |
|-------------|---------------|
| **Multilingual consent notice (Sec 6.3)** | Audio + text consent in all 22 scheduled languages via Bhashini TTS |
| **Purpose limitation (Sec 5)** | Data used ONLY for clinical summary generation — enforced by RBAC |
| **Data minimization** | Only clinically relevant data captured; no profiling |
| **Encryption at rest** | AES-256 encryption on PostgreSQL (pgcrypto) + MinIO server-side encryption |
| **Encryption in transit** | TLS 1.3 on all connections; WebSocket over WSS |
| **E2E encryption (ABDM)** | Fidelius protocol: Curve25519 + HKDF-SHA256 + AES-256-GCM |
| **Session isolation** | Temp audio/data cleared after session completion |
| **Breach notification (Sec 8)** | Automated alerting via monitoring stack |
| **Right to erasure (Sec 12)** | Patient portal for data deletion requests |
| **Children's data (Sec 9)** | Parent/guardian OTP verification for < 18 years |
| **Audit trail** | Immutable consent_audit_log table with timestamps |
| **Zero Aadhaar storage** | Raw Aadhaar NEVER persisted; only ABHA number stored |

---

## 14. Deployment & DevOps

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.9'
services:
  web:
    build: ./apps/web
    ports: ['3000:3000']
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080
      - NEXT_PUBLIC_WS_URL=ws://localhost:8081

  session-service:
    build: ./services/session-service
    ports: ['8080:8080']
    depends_on: [postgres, redis]

  history-service:
    build: ./services/history-service
    ports: ['8081:8081']
    depends_on: [postgres, redis, chromadb]

  document-service:
    build: ./services/document-service
    ports: ['8082:8082']
    depends_on: [postgres, minio]

  summary-service:
    build: ./services/summary-service
    ports: ['8083:8083']
    depends_on: [postgres]

  abdm-bridge:
    build: ./services/abdm-bridge
    ports: ['8084:8084']
    depends_on: [postgres]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: medikiosk
      POSTGRES_USER: medikiosk
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: ['pgdata:/var/lib/postgresql/data']
    ports: ['5432:5432']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

  chromadb:
    image: chromadb/chroma:latest
    ports: ['8000:8000']
    volumes: ['chromadata:/chroma/chroma']

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ['9000:9000', '9001:9001']
    volumes: ['miniodata:/data']

volumes:
  pgdata:
  chromadata:
  miniodata:
```

---

## 15. Testing Strategy

| Level | Tool | Scope |
|-------|------|-------|
| **Unit Tests** | Jest (TS) / pytest (Python) | Services, utilities, FHIR formatters |
| **Integration Tests** | Supertest / httpx | API endpoints, ABDM sandbox calls |
| **Voice Pipeline Tests** | Recorded audio fixtures | ASR accuracy, NMT quality, TTS output |
| **OCR Tests** | Sample prescription images | Entity extraction accuracy benchmarks |
| **E2E Tests** | Playwright | Full patient journey (UI flow) |
| **Load Tests** | k6 / Locust | 5000 concurrent WebSocket sessions |
| **Security Tests** | OWASP ZAP | DPDP compliance, injection prevention |
| **ABDM Compliance** | ABDM Sandbox Test Suite | HIP/HIU certification tests |

---

> [!IMPORTANT]
> **Resume Impact Statement:** This project demonstrates end-to-end ownership of a production-grade AI health platform — from **React/Next.js frontend design** to **Python ML/NLP pipelines**, **Node.js microservices**, **FHIR healthcare interoperability**, **real-time WebSocket voice streaming**, **RAG-powered generative AI**, **cloud-native Kubernetes deployment**, and **regulatory compliance engineering (DPDP Act)** — all built for 100 Cr+ user scale. This is the kind of system-level engineering that distinguishes a senior full-stack engineer who ships impactful products.
