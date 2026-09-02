"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  KioskHeader,
  KioskScreen,
  KioskBody,
  KioskFooter,
  AudioWave,
} from "@/components/kiosk/KioskLayout";
import { Button, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { COMMON_SYMPTOMS } from "@/lib/constants";
import { t } from "@/lib/translations";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import type { ChatMessage, StructuredSummary } from "@/app/api/history/chat/route";

type Stage =
  | "chief_complaint" | "duration" | "character"
  | "severity" | "associated_symptoms"
  | "past_history" | "medications" | "summary";

const STAGES: Stage[] = [
  "chief_complaint", "duration", "character",
  "severity", "associated_symptoms",
  "past_history", "medications",
];

const STAGE_LABELS: Record<Stage, string> = {
  chief_complaint: "मुख्य शिकायत",
  duration: "समय",
  character: "प्रकार",
  severity: "तीव्रता",
  associated_symptoms: "अन्य लक्षण",
  past_history: "पुराना इतिहास",
  medications: "दवाइयां",
  summary: "सारांश",
};

// Touch option chips per stage
const TOUCH_OPTIONS: Partial<Record<Stage, string[]>> = {
  chief_complaint: ["बुखार / Fever", "दर्द / Pain", "उल्टी / Vomiting",
    "सांस / Breathing", "चक्कर / Dizziness", "कमज़ोरी / Weakness",
    "खांसी / Cough", "पेट / Stomach"],
  duration: ["आज / Today", "2–3 दिन / 2–3 Days", "1 हफ्ता / 1 Week",
    "1 महीना / 1 Month", "3+ महीने / 3+ Months", "1+ साल / 1+ Year"],
  character: ["जलन / Burning", "दबाव / Pressing", "चुभन / Sharp",
    "खिंचाव / Pulling", "धड़कन / Throbbing", "सुन्न / Numbness"],
  severity: ["हल्का / Mild", "मध्यम / Moderate", "तेज़ / Severe", "बहुत तेज़ / Very Severe"],
  associated_symptoms: ["बुखार / Fever", "उल्टी / Vomiting", "दस्त / Diarrhea",
    "चक्कर / Dizziness", "पसीना / Sweating", "नहीं / None"],
  past_history: ["मधुमेह / Diabetes", "BP", "हृदय / Heart", "टीबी / TB",
    "ऑपरेशन / Surgery", "कुछ नहीं / Nothing"],
  medications: ["हाँ / Yes", "नहीं / No"],
};

export default function HistoryPage() {
  const router = useRouter();
  const [lang, setLang] = useState("hi");
  const [stage, setStage] = useState<Stage>("chief_complaint");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [patientInput, setPatientInput] = useState("");
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<"voice" | "touch">("voice");
  const [aiLoading, setAiLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState<StructuredSummary | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const hasAskedFirst = useRef(false);

  const stageIndex = STAGES.indexOf(stage);
  const progress = Math.round(((stageIndex + 1) / (STAGES.length + 1)) * 80) + 5;

  // ── Read sessionStorage ──────────────────────────────────────
  useEffect(() => {
    setLang(sessionStorage.getItem("mk_lang") ?? "hi");
  }, []);

  // ── Voice session ────────────────────────────────────────────
  const voice = useVoiceSession({
    lang,
    onTranscript: (text) => {
      setPatientInput(text);
    },
    onError: (msg) => setVoiceError(msg),
  });

  // ── Fetch first question on mount ────────────────────────────
  useEffect(() => {
    if (!hasAskedFirst.current && lang) {
      hasAskedFirst.current = true;
      fetchNextQuestion("chief_complaint", []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // ── Speak question when it changes ───────────────────────────
  useEffect(() => {
    if (currentQuestion && voice.isSupported) {
      voice.speak(currentQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion]);

  // ── API call to Gemini ───────────────────────────────────────
  const fetchNextQuestion = useCallback(
    async (forStage: Stage, history: ChatMessage[]) => {
      setAiLoading(true);
      try {
        const res = await fetch("/api/history/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang, messages: history, stage: forStage }),
        });
        const data = await res.json();
        if (data.isComplete && data.structuredSummary) {
          setSummary(data.structuredSummary);
          setIsComplete(true);
        } else {
          setCurrentQuestion(data.question);
          setStage(data.nextStage ?? forStage);
        }
      } catch {
        // Offline fallback — use static question
        const fallbacks: Record<Stage, string> = {
          chief_complaint: "आज आपको मुख्य रूप से क्या तकलीफ है?",
          duration: "यह तकलीफ कितने दिनों से है?",
          character: "दर्द या तकलीफ कैसी है?",
          severity: "दर्द कितना तेज़ है?",
          associated_symptoms: "क्या साथ में बुखार या उल्टी है?",
          past_history: "क्या पहले कोई बड़ी बीमारी हुई है?",
          medications: "क्या आप कोई दवाई ले रहे हैं?",
          summary: "",
        };
        setCurrentQuestion(fallbacks[forStage]);
      } finally {
        setAiLoading(false);
      }
    },
    [lang]
  );

  // ── Submit patient answer ────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const answer = selectedChips.length > 0
      ? selectedChips.join(", ")
      : patientInput.trim();

    if (!answer) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "ai", text: currentQuestion, stage },
      { role: "patient", text: answer, stage },
    ];
    setMessages(newMessages);
    setPatientInput("");
    setSelectedChips([]);

    const nextStage = STAGES[stageIndex + 1] ?? "summary";

    if (nextStage === "summary" || stageIndex >= STAGES.length - 1) {
      // Fetch structured summary
      setAiLoading(true);
      try {
        const res = await fetch("/api/history/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lang,
            messages: newMessages,
            stage: "medications", // triggers summary generation
          }),
        });
        const data = await res.json();
        if (data.structuredSummary) {
          setSummary(data.structuredSummary);
          setIsComplete(true);
          // Save to sessionStorage for summary page
          sessionStorage.setItem("mk_history", JSON.stringify({
            messages: newMessages,
            summary: data.structuredSummary,
          }));
        }
      } catch {
        setIsComplete(true);
        sessionStorage.setItem("mk_history", JSON.stringify({ messages: newMessages }));
      } finally {
        setAiLoading(false);
      }
    } else {
      await fetchNextQuestion(nextStage as Stage, newMessages);
    }
  }, [selectedChips, patientInput, messages, currentQuestion, stage, stageIndex, lang, fetchNextQuestion]);

  // ── Complete → go to scan page ───────────────────────────────
  useEffect(() => {
    if (isComplete && summary) {
      setTimeout(() => router.push("/scan"), 1200);
    }
  }, [isComplete, summary, router]);

  // ── Chip toggle ───────────────────────────────────────────────
  function toggleChip(chip: string) {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  }

  const canSubmit = selectedChips.length > 0 || patientInput.trim().length > 1;
  const chips = TOUCH_OPTIONS[stage] ?? COMMON_SYMPTOMS.slice(0, 8).map((s) => s.hi);

  // ── Complete screen ──────────────────────────────────────────
  if (isComplete) {
    return (
      <KioskScreen>
        <KioskBody className="flex flex-col items-center justify-center gap-4 py-16">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl"
          >
            ✅
          </motion.div>
          <h2 className="text-xl font-bold text-neutral-900 text-center">
            इतिहास पूरा हुआ
          </h2>
          <p className="text-sm text-neutral-400 text-center">
            History complete — moving to documents...
          </p>
          <div className="flex gap-1.5 mt-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-brand-500 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </KioskBody>
      </KioskScreen>
    );
  }

  return (
    <KioskScreen>
      <KioskHeader
        title={t(lang, "uploadDocuments").replace("Upload", "").trim() || "इतिहास"}
        subtitle={`Medical History · Stage ${stageIndex + 1} / ${STAGES.length}`}
        onBack={() => router.push("/consent")}
        progress={progress}
        stepLabel={`${stageIndex + 1} / ${STAGES.length}`}
        rightSlot={
          <div className="flex gap-1.5">
            <button
              onClick={() => setInputMode("voice")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                inputMode === "voice"
                  ? "bg-brand-600 text-white"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              )}
            >
              🎙️ {t(lang, "voiceMode")}
            </button>
            <button
              onClick={() => setInputMode("touch")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                inputMode === "touch"
                  ? "bg-secondary-500 text-white"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              )}
            >
              👆 {t(lang, "touchMode")}
            </button>
          </div>
        }
      />

      <KioskBody className="space-y-4">
        {/* Stage badge */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STAGES.map((s, i) => (
            <span
              key={s}
              className={cn(
                "shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold transition-all",
                i < stageIndex
                  ? "bg-brand-600 text-white"
                  : i === stageIndex
                  ? "bg-secondary-500 text-white"
                  : "bg-neutral-100 text-neutral-400"
              )}
            >
              {i < stageIndex ? "✓" : i + 1} {STAGE_LABELS[s]}
            </span>
          ))}
        </div>

        {/* AI Question bubble */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-brand-50 border border-brand-100 rounded-2xl p-4"
          >
            {aiLoading ? (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm shrink-0">
                  🤖
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 w-2 rounded-full bg-brand-400 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <button
                  onClick={() => voice.speak(currentQuestion)}
                  className="h-9 w-9 rounded-full bg-brand-600 flex items-center justify-center
                             text-white text-sm shrink-0 hover:bg-brand-700 transition-colors"
                  title="Play audio"
                >
                  {voice.isSpeaking ? "⏸" : "🔊"}
                </button>
                <p className="text-lg font-bold text-neutral-900 leading-snug pt-1">
                  {currentQuestion}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── VOICE MODE ── */}
        {inputMode === "voice" && (
          <div className="flex flex-col items-center gap-4 py-2">
            {/* Big mic button */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={voice.isListening ? voice.stopListening : voice.startListening}
              className={cn(
                "h-24 w-24 rounded-full flex items-center justify-center text-4xl",
                "shadow-lg transition-all duration-200",
                voice.isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              )}
            >
              {voice.isListening ? "⏹" : "🎙️"}
            </motion.button>

            <p className="text-sm font-semibold text-neutral-500">
              {voice.isListening
                ? t(lang, "listening")
                : t(lang, "tapToSpeak")}
            </p>

            {/* Live transcript */}
            {voice.transcript && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full bg-neutral-50 rounded-xl border border-neutral-200 p-3"
              >
                <p className="text-xs text-neutral-400 mb-1">{t(lang, "transcribed")}:</p>
                <p className="text-base font-semibold text-neutral-800">{voice.transcript}</p>
              </motion.div>
            )}

            {/* Override with text if voice failed */}
            {patientInput && (
              <div className="w-full">
                <input
                  type="text"
                  value={patientInput}
                  onChange={(e) => setPatientInput(e.target.value)}
                  className="w-full border-2 border-brand-200 rounded-xl px-4 py-3
                             text-base focus:outline-none focus:border-brand-500"
                  placeholder="या यहाँ टाइप करें..."
                />
              </div>
            )}

            {voiceError && (
              <p className="text-xs text-red-500 text-center">{voiceError}</p>
            )}

            <p className="text-xs text-neutral-400">{t(lang, "orTapBelow")}</p>
          </div>
        )}

        {/* ── TOUCH MODE ── */}
        {inputMode === "touch" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => toggleChip(chip)}
                  className={cn(
                    "px-4 py-2.5 rounded-full text-sm font-semibold transition-all",
                    "border-2 min-h-[44px]",
                    selectedChips.includes(chip)
                      ? "bg-brand-600 border-brand-600 text-white"
                      : "bg-white border-neutral-200 text-neutral-700 hover:border-brand-300"
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
            {/* Freeform text */}
            <input
              type="text"
              value={patientInput}
              onChange={(e) => setPatientInput(e.target.value)}
              className="w-full border-2 border-neutral-200 rounded-xl px-4 py-3
                         text-base focus:outline-none focus:border-brand-500 transition-colors"
              placeholder={`${t(lang, "yourMainProblem")} (वैकल्पिक)`}
            />
          </div>
        )}

        {/* AudioWave indicator when listening */}
        {voice.isListening && (
          <div className="flex justify-center">
            <AudioWave active={true} bars={9} />
          </div>
        )}
      </KioskBody>

      <KioskFooter>
        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={!canSubmit || aiLoading || voice.isListening}
          loading={aiLoading}
          onClick={handleSubmit}
        >
          {stageIndex >= STAGES.length - 1
            ? `✅ ${t(lang, "done")}`
            : `${t(lang, "next")} →`}
        </Button>
      </KioskFooter>
    </KioskScreen>
  );
}
