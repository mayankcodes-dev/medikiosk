"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
import { COMMON_SYMPTOMS, HISTORY_SECTIONS } from "@/lib/constants";
import { t } from "@/lib/translations";

// ── Mock dialog flow for Phase 0 ─────────────────────────────────
const MOCK_QUESTIONS = [
  {
    id: "cc",
    section: "chief_complaint",
    question: "आपको आज क्या तकलीफ है?",
    questionEn: "What is your main problem today?",
    useSymptomPicker: true,
    options: COMMON_SYMPTOMS,
    sectionLabel: "मुख्य शिकायत / Chief Complaint",
    progress: 10,
  },
  {
    id: "duration",
    section: "hpi",
    question: "यह तकलीफ कब से है?",
    questionEn: "Since when are you having this problem?",
    sectionLabel: "वर्तमान बीमारी / HPI",
    progress: 25,
    options: [
      { id: "today", icon: "📅", labelHi: "आज से", labelEn: "Since today" },
      { id: "2-3days", icon: "📆", labelHi: "2-3 दिन से", labelEn: "2–3 days" },
      { id: "1week", icon: "🗓️", labelHi: "एक हफ्ते से", labelEn: "About a week" },
      { id: "1month", icon: "📅", labelHi: "एक महीने से", labelEn: "1 month+" },
      { id: "longer", icon: "⏳", labelHi: "बहुत पुरानी", labelEn: "Longer" },
    ],
  },
  {
    id: "severity",
    section: "hpi",
    question: "दर्द / तकलीफ कितनी तेज़ है?",
    questionEn: "How severe is the pain/discomfort? (1 = mild, 10 = worst)",
    sectionLabel: "वर्तमान बीमारी / HPI",
    progress: 38,
    options: [
      { id: "1-3", icon: "😊", labelHi: "हल्का (1–3)", labelEn: "Mild (1–3)" },
      { id: "4-6", icon: "😐", labelHi: "मध्यम (4–6)", labelEn: "Moderate (4–6)" },
      { id: "7-8", icon: "😣", labelHi: "तेज़ (7–8)", labelEn: "Severe (7–8)" },
      { id: "9-10", icon: "😭", labelHi: "बहुत तेज़ (9–10)", labelEn: "Very severe (9–10)" },
    ],
  },
  {
    id: "pastillness",
    section: "past_medical",
    question: "क्या आपको पहले से कोई बीमारी है?",
    questionEn: "Do you have any existing medical conditions?",
    sectionLabel: "पुरानी बीमारियां / Past Medical History",
    progress: 55,
    options: [
      { id: "diabetes", icon: "🩸", labelHi: "मधुमेह / Sugar", labelEn: "Diabetes" },
      { id: "bp", icon: "💉", labelHi: "उच्च रक्तचाप", labelEn: "High BP" },
      { id: "thyroid", icon: "🦋", labelHi: "थाइरॉइड", labelEn: "Thyroid" },
      { id: "asthma", icon: "🫁", labelHi: "दमा / Asthma", labelEn: "Asthma" },
      { id: "heart", icon: "❤️", labelHi: "हृदय रोग", labelEn: "Heart disease" },
      { id: "none", icon: "✅", labelHi: "कोई नहीं", labelEn: "None" },
    ],
  },
  {
    id: "medicines",
    section: "drug_history",
    question: "क्या आप कोई दवाई ले रहे हैं?",
    questionEn: "Are you currently taking any medicines?",
    sectionLabel: "दवाइयां / Drug History",
    progress: 72,
    options: [
      { id: "yes", icon: "💊", labelHi: "हाँ, नियमित", labelEn: "Yes, regularly" },
      { id: "sometimes", icon: "⚗️", labelHi: "कभी-कभी", labelEn: "Sometimes" },
      { id: "no", icon: "❌", labelHi: "नहीं", labelEn: "No" },
    ],
  },
  {
    id: "allergy",
    section: "allergy",
    question: "क्या आपको किसी दवाई से एलर्जी है?",
    questionEn: "Do you have any known drug allergies?",
    sectionLabel: "एलर्जी / Allergy",
    progress: 85,
    options: [
      { id: "penicillin", icon: "💊", labelHi: "पेनिसिलिन", labelEn: "Penicillin" },
      { id: "aspirin", icon: "💊", labelHi: "एस्पिरिन", labelEn: "Aspirin" },
      { id: "sulfa", icon: "💊", labelHi: "सल्फा", labelEn: "Sulfa drugs" },
      { id: "none", icon: "✅", labelHi: "कोई नहीं", labelEn: "None known" },
    ],
  },
];

type AnswerMap = Record<string, string[]>;
type InputMode = "voice" | "touch";

export default function HistoryPage() {
  const router = useRouter();
  const [lang, setLang] = useState("hi");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>("touch");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceAnswer, setVoiceAnswer] = useState("");

  useEffect(() => {
    setLang(sessionStorage.getItem("mk_lang") ?? "hi");
  }, []);

  const currentQ = MOCK_QUESTIONS[qIndex];
  const isLast = qIndex === MOCK_QUESTIONS.length - 1;
  const canProceed = selected.length > 0 || voiceAnswer.length > 2;

  // ── Toggle touch option (supports multi-select for some Qs) ───
  function toggleOption(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : id === "none" || id === "no"
        ? [id]                       // exclusive "none/no" option
        : [...prev.filter((x) => x !== "none" && x !== "no"), id]
    );
  }

  // ── Mock voice recording ───────────────────────────────────────
  async function startRecording() {
    setRecording(true);
    setTranscript("");
    setVoiceAnswer("");
    // Simulate ASR transcription after 2s
    await new Promise((r) => setTimeout(r, 2500));
    const mockTranscripts: Record<string, string> = {
      cc: "मुझे बुखार और सिरदर्द है",
      duration: "तीन दिन से",
      severity: "मध्यम दर्द है",
      pastillness: "मुझे sugar है",
      medicines: "Metformin लेता हूं",
      allergy: "कोई एलर्जी नहीं",
    };
    const t = mockTranscripts[currentQ.id] ?? "पता नहीं";
    setTranscript(t);
    setVoiceAnswer(t);
    setRecording(false);
  }

  // ── Save answer and move to next question ─────────────────────
  function handleNext() {
    const answerValue =
      inputMode === "voice"
        ? [voiceAnswer]
        : selected;

    const newAnswers: AnswerMap = {
      ...answers,
      [currentQ.id]: answerValue,
    };
    setAnswers(newAnswers);

    if (isLast) {
      sessionStorage.setItem("mk_history", JSON.stringify(newAnswers));
      router.push("/scan");
    } else {
      setQIndex((i) => i + 1);
      setSelected([]);
      setVoiceAnswer("");
      setTranscript("");
    }
  }

  return (
    <KioskScreen>
      <KioskHeader
        title={currentQ.sectionLabel}
        onBack={qIndex > 0 ? () => { setQIndex((i) => i - 1); setSelected([]); } : () => router.push("/consent")}
        progress={currentQ.progress}
        stepLabel={`${qIndex + 1} / ${MOCK_QUESTIONS.length}`}
      />

      <KioskBody className="space-y-6">
        {/* ── Question bubble ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="bg-brand-50 border border-brand-100 rounded-2xl p-5"
          >
            <div className="flex gap-3">
              <span className="text-3xl shrink-0">🩺</span>
              <div>
                <p className="text-xl font-bold text-neutral-900 text-balance">
                  {currentQ.question}
                </p>
                <p className="text-sm text-neutral-500 mt-1">
                  {currentQ.questionEn}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Input mode toggle ── */}
        <div className="flex gap-2 bg-neutral-100 p-1 rounded-xl">
          {(["voice", "touch"] as InputMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setInputMode(m); setSelected([]); setVoiceAnswer(""); }}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                inputMode === m
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              {m === "voice" ? "🎙️ Voice / बोलें" : "☝️ Touch / टैप करें"}
            </button>
          ))}
        </div>

        {/* ── Voice mode ── */}
        {inputMode === "voice" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <button
              onClick={recording ? undefined : startRecording}
              className={cn(
                "h-24 w-24 rounded-full flex items-center justify-center text-4xl",
                "transition-all duration-300 focus-visible:ring-4 focus-visible:ring-brand-300",
                recording
                  ? "bg-error-600 text-white pulse-ring shadow-lg scale-110"
                  : "bg-brand-600 text-white hover:bg-brand-700 shadow-md hover:shadow-lg"
              )}
              aria-label={recording ? "Recording..." : "Tap to speak"}
            >
              {recording ? "⏹️" : "🎙️"}
            </button>

            <AudioWave active={recording} />

            <p className="text-sm text-neutral-500">
              {recording ? "सुन रहे हैं... / Listening..." : "माइक दबाकर बोलें / Tap mic to speak"}
            </p>

            {transcript && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full bg-success-50 border border-success-200 rounded-2xl p-4"
              >
                <p className="text-xs text-success-600 font-semibold mb-1">
                  ✅ Transcribed / सुना गया:
                </p>
                <p className="text-neutral-800 font-medium">"{transcript}"</p>
              </motion.div>
            )}
          </div>
        )}

        {/* ── Touch mode — symptom / option grid ── */}
        {inputMode === "touch" && (
          <div className={cn(
            "grid gap-3",
            currentQ.useSymptomPicker ? "grid-cols-3" : "grid-cols-2"
          )}>
            {currentQ.options?.map((opt) => {
              const isChecked = selected.includes(opt.id);
              return (
                <motion.button
                  key={opt.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleOption(opt.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-3",
                    "rounded-2xl border-2 min-h-[80px] transition-all duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    isChecked
                      ? "border-brand-500 bg-brand-50 shadow-sm"
                      : "border-neutral-200 bg-white hover:border-brand-300 hover:bg-brand-50/50"
                  )}
                >
                  <span className="text-2xl leading-none">{opt.icon}</span>
                  <span className={cn(
                    "text-center font-semibold leading-tight",
                    currentQ.useSymptomPicker ? "text-xs" : "text-sm",
                    isChecked ? "text-brand-700" : "text-neutral-700"
                  )}>
                    {opt.labelHi}
                  </span>
                  {!currentQ.useSymptomPicker && (
                    <span className="text-xs text-neutral-400">{opt.labelEn}</span>
                  )}
                  {isChecked && (
                    <span className="text-brand-500 text-base">✓</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </KioskBody>

      <KioskFooter>
        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={!canProceed}
          onClick={handleNext}
        >
          {isLast ? "✅ पूरा हो गया / Done" : "आगे बढ़ें / Next →"}
        </Button>
        {!canProceed && (
          <p className="text-center text-xs text-neutral-400 mt-2">
            कोई एक विकल्प चुनें या बोलें / Choose an option or speak
          </p>
        )}
      </KioskFooter>
    </KioskScreen>
  );
}
