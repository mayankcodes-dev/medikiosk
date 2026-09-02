// src/lib/bhashini.ts
// Bhashini Dhruva API client — ASR + TTS for 22 Indian languages
// Used by useVoiceSession hook. Falls back to Web Speech API if keys absent.

const DHRUVA_ENDPOINT =
  process.env.NEXT_PUBLIC_BHASHINI_INFERENCE_URL ??
  "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";

const USER_ID = process.env.NEXT_PUBLIC_BHASHINI_USER_ID ?? "";
const API_KEY = process.env.NEXT_PUBLIC_BHASHINI_API_KEY ?? "";

// ── Language → Bhashini service IDs ─────────────────────────────
// ASR service IDs (AI4Bharat IndicConformer models)
const ASR_SERVICE_IDS: Record<string, string> = {
  hi: "ai4bharat/conformer-hi-gpu--t4",
  en: "ai4bharat/whisper-medium-en--gpu--t4",
  bn: "ai4bharat/conformer-bn-gpu--t4",
  ta: "ai4bharat/conformer-ta-gpu--t4",
  te: "ai4bharat/conformer-te-gpu--t4",
  mr: "ai4bharat/conformer-mr-gpu--t4",
  gu: "ai4bharat/conformer-gu-gpu--t4",
  kn: "ai4bharat/conformer-kn-gpu--t4",
  ml: "ai4bharat/conformer-ml-gpu--t4",
  pa: "ai4bharat/conformer-pa-gpu--t4",
  or: "ai4bharat/conformer-or-gpu--t4",
  as: "ai4bharat/conformer-as-gpu--t4",
  ur: "ai4bharat/conformer-ur-gpu--t4",
};

// TTS service IDs (AI4Bharat IndicTTS)
const TTS_SERVICE_IDS: Record<string, string> = {
  hi: "ai4bharat/indic-tts-coqui-hi-gpu--t4",
  en: "ai4bharat/indic-tts-coqui-en-gpu--t4",
  bn: "ai4bharat/indic-tts-coqui-bn-gpu--t4",
  ta: "ai4bharat/indic-tts-coqui-ta-gpu--t4",
  te: "ai4bharat/indic-tts-coqui-te-gpu--t4",
  mr: "ai4bharat/indic-tts-coqui-mr-gpu--t4",
  gu: "ai4bharat/indic-tts-coqui-gu-gpu--t4",
  kn: "ai4bharat/indic-tts-coqui-kn-gpu--t4",
  ml: "ai4bharat/indic-tts-coqui-ml-gpu--t4",
  pa: "ai4bharat/indic-tts-coqui-pa-gpu--t4",
  or: "ai4bharat/indic-tts-coqui-or-gpu--t4",
  as: "ai4bharat/indic-tts-coqui-as-gpu--t4",
  ur: "ai4bharat/indic-tts-coqui-ur-gpu--t4",
};

// ── Check if Bhashini is configured ──────────────────────────────
export function isBhashiniConfigured(): boolean {
  return Boolean(USER_ID && API_KEY);
}

// ── Common headers ────────────────────────────────────────────────
function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: API_KEY,
    userID: USER_ID,
  };
}

// ── ASR: Audio Blob → Transcript string ──────────────────────────
export async function bhashiniASR(
  audioBlob: Blob,
  lang: string
): Promise<string> {
  // Convert blob to base64
  const arrayBuffer = await audioBlob.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  const base64Audio = btoa(binary);

  const serviceId = ASR_SERVICE_IDS[lang] ?? ASR_SERVICE_IDS["hi"];

  const payload = {
    pipelineTasks: [
      {
        taskType: "asr",
        config: {
          language: { sourceLanguage: lang },
          serviceId,
          audioFormat: "wav",
          samplingRate: 16000,
          postProcessors: null,
        },
      },
    ],
    inputData: {
      audio: [{ audioContent: base64Audio }],
    },
  };

  const res = await fetch(DHRUVA_ENDPOINT, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Bhashini ASR error: ${res.status}`);

  const data = await res.json();
  const transcript =
    data?.pipelineResponse?.[0]?.output?.[0]?.source ?? "";
  return transcript.trim();
}

// ── TTS: Text → AudioBuffer (plays in browser) ───────────────────
export async function bhashiniTTS(
  text: string,
  lang: string,
  gender: "male" | "female" = "female"
): Promise<ArrayBuffer | null> {
  const serviceId = TTS_SERVICE_IDS[lang] ?? TTS_SERVICE_IDS["hi"];

  const payload = {
    pipelineTasks: [
      {
        taskType: "tts",
        config: {
          language: { sourceLanguage: lang },
          serviceId,
          gender,
          samplingRate: 8000,
        },
      },
    ],
    inputData: {
      input: [{ source: text }],
      audio: [{ audioContent: null }],
    },
  };

  const res = await fetch(DHRUVA_ENDPOINT, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Bhashini TTS error: ${res.status}`);

  const data = await res.json();
  const b64Audio =
    data?.pipelineResponse?.[0]?.audio?.[0]?.audioContent ?? null;
  if (!b64Audio) return null;

  // Decode base64 → ArrayBuffer
  const binaryStr = atob(b64Audio);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes.buffer;
}

// ── Play ArrayBuffer as audio in browser ─────────────────────────
export async function playAudioBuffer(
  buffer: ArrayBuffer,
  onEnd?: () => void
): Promise<void> {
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(buffer);
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.onended = () => {
    audioCtx.close();
    onEnd?.();
  };
  source.start(0);
}
