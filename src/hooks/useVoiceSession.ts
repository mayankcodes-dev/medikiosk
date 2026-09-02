"use client";

// src/hooks/useVoiceSession.ts
// 3-layer voice pipeline:
//   Layer 1: Bhashini Dhruva (IndicConformer ASR + IndicTTS) — primary when key available
//   Layer 2: Browser Web Speech API (Chrome) — fallback (10/13 languages)
//   Layer 3: Silent mode — touch-only when both unavailable
//
// To enable Bhashini: set NEXT_PUBLIC_BHASHINI_USER_ID + NEXT_PUBLIC_BHASHINI_API_KEY in .env.local
// Hook interface stays identical — swap is transparent to UI.

import { useState, useRef, useCallback, useEffect } from "react";
import {
  isBhashiniConfigured,
  bhashiniASR,
  bhashiniTTS,
  playAudioBuffer,
} from "@/lib/bhashini";

export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

export type VoiceEngine = "bhashini" | "webspeech" | "none";

interface UseVoiceSessionOptions {
  lang: string;
  onTranscript: (text: string) => void;
  onError?: (msg: string) => void;
}

// ── Browser Web Speech API — supported languages in Chrome ───────
// ✅ = full support  ⚠️ = partial  ❌ = not supported
const WEB_SPEECH_LANGS: Record<string, { bcp47: string; supported: boolean }> = {
  hi: { bcp47: "hi-IN", supported: true },   // ✅ Hindi
  en: { bcp47: "en-IN", supported: true },   // ✅ English (India)
  bn: { bcp47: "bn-IN", supported: true },   // ✅ Bengali
  ta: { bcp47: "ta-IN", supported: true },   // ✅ Tamil
  te: { bcp47: "te-IN", supported: true },   // ✅ Telugu
  mr: { bcp47: "mr-IN", supported: true },   // ✅ Marathi
  gu: { bcp47: "gu-IN", supported: true },   // ✅ Gujarati
  kn: { bcp47: "kn-IN", supported: true },   // ✅ Kannada
  ml: { bcp47: "ml-IN", supported: true },   // ✅ Malayalam
  pa: { bcp47: "pa-IN", supported: true },   // ✅ Punjabi
  ur: { bcp47: "ur-PK", supported: false },  // ❌ Urdu (not in Chrome)
  or: { bcp47: "or-IN", supported: false },  // ❌ Odia (not in Chrome)
  as: { bcp47: "as-IN", supported: false },  // ❌ Assamese (not in Chrome)
};

// ── MediaRecorder for Bhashini (captures raw audio) ──────────────
class BhashiniRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(250); // collect every 250ms
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob([], { type: "audio/webm" }));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        this.stream?.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }
}

export function useVoiceSession({
  lang,
  onTranscript,
  onError,
}: UseVoiceSessionOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [engine, setEngine] = useState<VoiceEngine>("none");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const recorderRef = useRef<BhashiniRecorder | null>(null);

  const webSpeechInfo = WEB_SPEECH_LANGS[lang] ?? { bcp47: "hi-IN", supported: false };

  // ── Determine active engine on mount / lang change ────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    synthRef.current = window.speechSynthesis;

    if (isBhashiniConfigured()) {
      setEngine("bhashini");
    } else if (
      webSpeechInfo.supported &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      setEngine("webspeech");
    } else {
      setEngine("none");
    }

    return () => {
      recognitionRef.current?.stop();
      synthRef.current?.cancel();
    };
  }, [lang, webSpeechInfo.supported]);

  // ────────────────────────────────────────────────────────────────
  // SPEAK — Bhashini TTS primary, SpeechSynthesis fallback
  // ────────────────────────────────────────────────────────────────
  const speak = useCallback(
    async (text: string, onEnd?: () => void) => {
      if (!text) { onEnd?.(); return; }
      synthRef.current?.cancel();
      setState("speaking");
      setIsSpeaking(true);

      // ── Bhashini TTS ─────────────────────────────────────────
      if (engine === "bhashini") {
        try {
          const buffer = await bhashiniTTS(text, lang, "female");
          if (buffer) {
            await playAudioBuffer(buffer, () => {
              setIsSpeaking(false);
              setState("idle");
              onEnd?.();
            });
            return;
          }
        } catch (e) {
          console.warn("[Voice] Bhashini TTS failed, falling back:", e);
        }
      }

      // ── Web Speech Synthesis fallback ────────────────────────
      if (!synthRef.current) { setIsSpeaking(false); setState("idle"); onEnd?.(); return; }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = webSpeechInfo.bcp47;
      utter.rate = 0.88;
      utter.pitch = 1.0;
      const voices = synthRef.current.getVoices();
      const match = voices.find((v) => v.lang.startsWith(lang) || v.lang === webSpeechInfo.bcp47);
      if (match) utter.voice = match;
      utter.onend = () => { setIsSpeaking(false); setState("idle"); onEnd?.(); };
      utter.onerror = () => { setIsSpeaking(false); setState("idle"); onEnd?.(); };
      synthRef.current.speak(utter);
    },
    [engine, lang, webSpeechInfo.bcp47]
  );

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
    setState("idle");
  }, []);

  // ────────────────────────────────────────────────────────────────
  // START LISTENING — Bhashini ASR primary, Web Speech fallback
  // ────────────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    setTranscript("");
    setState("listening");

    // ── Bhashini ASR (MediaRecorder → Dhruva) ───────────────────
    if (engine === "bhashini") {
      try {
        const recorder = new BhashiniRecorder();
        recorderRef.current = recorder;
        await recorder.start();
        return; // stop() called by stopListening()
      } catch (e) {
        console.warn("[Voice] Bhashini recorder failed, falling back:", e);
        // fall through to Web Speech API
      }
    }

    // ── Web Speech API fallback ──────────────────────────────────
    const SpeechRecognitionAPI =
      (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI || !webSpeechInfo.supported) {
      onError?.(
        lang === "ur"
          ? "Urdu voice not supported in browser. Bhashini key needed. Use touch input."
          : lang === "or"
          ? "Odia voice not supported in browser. Bhashini key needed. Use touch input."
          : lang === "as"
          ? "Assamese voice not supported in browser. Bhashini key needed. Use touch input."
          : "Voice recognition not supported. Use Chrome or touch input."
      );
      setState("error");
      return;
    }

    recognitionRef.current?.stop();
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = webSpeechInfo.bcp47;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const shown = final || interim;
      setTranscript(shown);
      if (final) { onTranscript(final.trim()); setState("processing"); }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "no-speech") setState("idle");
      else { onError?.(`Mic error: ${e.error}`); setState("error"); }
    };

    recognition.onend = () => { if (state === "listening") setState("idle"); };
    recognitionRef.current = recognition;
    recognition.start();
  }, [engine, lang, webSpeechInfo, onError, onTranscript, state]);

  // ── Stop listening (Bhashini: stop recorder → send to API) ─────
  const stopListening = useCallback(async () => {
    // Bhashini: stop MediaRecorder → POST audio
    if (engine === "bhashini" && recorderRef.current) {
      setState("processing");
      try {
        const blob = await recorderRef.current.stop();
        recorderRef.current = null;
        const text = await bhashiniASR(blob, lang);
        if (text) {
          setTranscript(text);
          onTranscript(text);
        }
      } catch (e) {
        console.warn("[Voice] Bhashini ASR failed:", e);
        onError?.("Voice recognition failed. Please try again.");
      } finally {
        setState("idle");
      }
      return;
    }

    // Web Speech: just stop
    recognitionRef.current?.stop();
    setState("idle");
  }, [engine, lang, onTranscript, onError]);

  return {
    state,
    transcript,
    isSpeaking,
    engine,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    isListening: state === "listening",
    isSupported: engine !== "none",
    webSpeechSupported: webSpeechInfo.supported,
  };
}
