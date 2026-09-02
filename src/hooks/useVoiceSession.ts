"use client";

// src/hooks/useVoiceSession.ts
// Voice session hook — uses browser Web Speech API now,
// Bhashini Dhruva WebSocket drops in when API keys are approved.

import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

interface UseVoiceSessionOptions {
  lang: string;           // BCP-47 language code e.g. "hi-IN"
  onTranscript: (text: string) => void;
  onError?: (msg: string) => void;
}

// Map our short codes to BCP-47 for Web Speech API
const LANG_TO_BCP47: Record<string, string> = {
  hi: "hi-IN", en: "en-IN", bn: "bn-IN", ta: "ta-IN",
  te: "te-IN", mr: "mr-IN", gu: "gu-IN", kn: "kn-IN",
  ml: "ml-IN", pa: "pa-IN", ur: "ur-IN", or: "or-IN", as: "as-IN",
};

export function useVoiceSession({
  lang,
  onTranscript,
  onError,
}: UseVoiceSessionOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const bcp47 = LANG_TO_BCP47[lang] ?? "hi-IN";

  // ── Init speech synthesis ─────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      recognitionRef.current?.stop();
      synthRef.current?.cancel();
    };
  }, []);

  // ── Speak (TTS) ───────────────────────────────────────────────
  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!synthRef.current || !text) {
        onEnd?.();
        return;
      }
      synthRef.current.cancel(); // stop any ongoing speech
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = bcp47;
      utter.rate = 0.88;   // slightly slower for clarity
      utter.pitch = 1.0;

      // Try to find a voice matching the language
      const voices = synthRef.current.getVoices();
      const match = voices.find(
        (v) => v.lang.startsWith(lang) || v.lang === bcp47
      );
      if (match) utter.voice = match;

      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => {
        setIsSpeaking(false);
        onEnd?.();
      };
      utter.onerror = () => {
        setIsSpeaking(false);
        onEnd?.();
      };

      setState("speaking");
      synthRef.current.speak(utter);
    },
    [lang, bcp47]
  );

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
    setState("idle");
  }, []);

  // ── Start listening (ASR) ──────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as typeof window & {
        SpeechRecognition?: typeof SpeechRecognition;
        webkitSpeechRecognition?: typeof SpeechRecognition;
      }).SpeechRecognition ??
      (window as typeof window & {
        webkitSpeechRecognition?: typeof SpeechRecognition;
      }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      onError?.("Voice recognition not supported in this browser. Use Chrome.");
      setState("error");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = bcp47;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const displayed = final || interim;
      setTranscript(displayed);
      if (final) {
        onTranscript(final.trim());
        setState("processing");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        setState("idle");
      } else {
        onError?.(`Microphone error: ${event.error}`);
        setState("error");
      }
    };

    recognition.onend = () => {
      if (state === "listening") setState("idle");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [bcp47, onError, onTranscript, state]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setState("idle");
  }, []);

  return {
    state,
    transcript,
    isSpeaking,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    isListening: state === "listening",
    isSupported: typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
  };
}
