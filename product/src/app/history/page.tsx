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
  | "chief_complaint" | "hpi"
  | "past_history" | "drug_allergy"
  | "family_history" | "personal_history" | "review_of_systems"
  | "ayush_prakriti" | "ayush_vikriti" | "ayush_agni"
  | "ayush_koshtha" | "ayush_ahara_vihara" | "ayush_nidana" | "ayush_samprapti"
  | "summary";

const STAGES: Stage[] = [
  "chief_complaint", "hpi",
  "past_history", "drug_allergy",
  "family_history", "personal_history", "review_of_systems",
];

// Multilingual stage labels
function getStageLabels(lang: string): Record<Stage, string> {
  const labels: Record<string, Record<Stage, string>> = {
    hi: {
      chief_complaint: "मुख्य शिकायत", hpi: "वर्तमान बीमारी",
      past_history: "पुराना इतिहास", drug_allergy: "दवा/एलर्जी",
      family_history: "पारिवारिक इतिहास", personal_history: "व्यक्तिगत इतिहास",
      review_of_systems: "सिस्टम समीक्षा",
      ayush_prakriti: "प्रकृति", ayush_vikriti: "विकृति", ayush_agni: "अग्नि",
      ayush_koshtha: "कोष्ठ", ayush_ahara_vihara: "आहार-विहार",
      ayush_nidana: "निदान", ayush_samprapti: "सम्प्राप्ति", summary: "सारांश",
    },
    en: {
      chief_complaint: "Problem", hpi: "HPI",
      past_history: "Past History", drug_allergy: "Drug/Allergy",
      family_history: "Family Hx", personal_history: "Personal Hx",
      review_of_systems: "Review of Systems",
      ayush_prakriti: "Prakriti", ayush_vikriti: "Vikriti", ayush_agni: "Agni",
      ayush_koshtha: "Koshtha", ayush_ahara_vihara: "Ahara-Vihara",
      ayush_nidana: "Nidana", ayush_samprapti: "Samprapti", summary: "Summary",
    },
    ta: {
      chief_complaint: "பிரச்சினை", hpi: "நடப்பு நோய்",
      past_history: "முன்வரலாறு", drug_allergy: "மருந்து/ஒவ்வாமை",
      family_history: "குடும்ப வரலாறு", personal_history: "தனிப்பட்ட வரலாறு",
      review_of_systems: "உறுப்பு பரிசோதனை",
      ayush_prakriti: "பிரகிருதி", ayush_vikriti: "விகிருதி", ayush_agni: "அக்னி",
      ayush_koshtha: "கோஷ்ட", ayush_ahara_vihara: "ஆகார-விஹார",
      ayush_nidana: "நிதான", ayush_samprapti: "சம்ப்ராப்தி", summary: "சுருக்கம்",
    },
    te: {
      chief_complaint: "సమస్య", hpi: "ప్రస్తుత అనారోగ్యం",
      past_history: "గత చరిత్ర", drug_allergy: "మందు/అలర్జీ",
      family_history: "కుటుంబ చరిత్ర", personal_history: "వ్యక్తిగత చరిత్ర",
      review_of_systems: "అవయవ సమీక్ష",
      ayush_prakriti: "ప్రకృతి", ayush_vikriti: "వికృతి", ayush_agni: "అగ్ని",
      ayush_koshtha: "కోష్ఠ", ayush_ahara_vihara: "ఆహార-విహార",
      ayush_nidana: "నిదాన", ayush_samprapti: "సంప్రాప్తి", summary: "సారాంశం",
    },
    bn: {
      chief_complaint: "সমস্যা", hpi: "বর্তমান অসুস্থতা",
      past_history: "পূর্ব ইতিহাস", drug_allergy: "ওষুধ/অ্যালার্জি",
      family_history: "পারিবারিক ইতিহাস", personal_history: "ব্যক্তিগত ইতিহাস",
      review_of_systems: "সিস্টেম পর্যালোচনা",
      ayush_prakriti: "প্রকৃতি", ayush_vikriti: "বিকৃতি", ayush_agni: "অগ্নি",
      ayush_koshtha: "কোষ্ঠ", ayush_ahara_vihara: "আহার-বিহার",
      ayush_nidana: "নিদান", ayush_samprapti: "সম্প্রাপ্তি", summary: "সারাংশ",
    },
    mr: {
      chief_complaint: "समस्या", hpi: "सद्य आजार",
      past_history: "जुनी माहिती", drug_allergy: "औषध/ॲलर्जी",
      family_history: "कौटुंबिक इतिहास", personal_history: "वैयक्तिक इतिहास",
      review_of_systems: "अवयव आढावा",
      ayush_prakriti: "प्रकृती", ayush_vikriti: "विकृती", ayush_agni: "अग्नी",
      ayush_koshtha: "कोष्ठ", ayush_ahara_vihara: "आहार-विहार",
      ayush_nidana: "निदान", ayush_samprapti: "संप्राप्ती", summary: "सारांश",
    },
    gu: {
      chief_complaint: "સમસ્યા", hpi: "વર્તમાન બીમારી",
      past_history: "જૂનો ઇતિહાસ", drug_allergy: "દવા/એલર્જી",
      family_history: "કૌટુંબિક ઇતિહાસ", personal_history: "વ્યક્તિગત ઇતિહાસ",
      review_of_systems: "પ્રણાલી સમીક્ષા",
      ayush_prakriti: "પ્રકૃતિ", ayush_vikriti: "વિકૃતિ", ayush_agni: "અગ્નિ",
      ayush_koshtha: "કોષ્ઠ", ayush_ahara_vihara: "આહાર-વિહાર",
      ayush_nidana: "નિદાન", ayush_samprapti: "સંપ્રાપ્તિ", summary: "સારાંશ",
    },
    kn: {
      chief_complaint: "ಸಮಸ್ಯೆ", hpi: "ಪ್ರಸ್ತುತ ಕಾಯಿಲೆ",
      past_history: "ಹಿಂದಿನ ಇತಿಹಾಸ", drug_allergy: "ಔಷಧ/ಅಲರ್ಜಿ",
      family_history: "ಕುಟುಂಬ ಇತಿಹಾಸ", personal_history: "ವ್ಯಕ್ತಿಗತ ಇತಿಹಾಸ",
      review_of_systems: "ಅವಯವ ಸಮೀಕ್ಷೆ",
      ayush_prakriti: "ಪ್ರಕೃತಿ", ayush_vikriti: "ವಿಕೃತಿ", ayush_agni: "ಅಗ್ನಿ",
      ayush_koshtha: "ಕೋಷ್ಠ", ayush_ahara_vihara: "ಆಹಾರ-ವಿಹಾರ",
      ayush_nidana: "ನಿದಾನ", ayush_samprapti: "ಸಂಪ್ರಾಪ್ತಿ", summary: "ಸಾರಾಂಶ",
    },
    ml: {
      chief_complaint: "പ്രശ്നം", hpi: "നിലവിലെ അസുഖം",
      past_history: "മുൻ ചരിത്രം", drug_allergy: "മരുന്ന്/ആലർജി",
      family_history: "കുടുംബ ചരിത്രം", personal_history: "വ്യക്തിഗത ചരിത്രം",
      review_of_systems: "അവയവ അവലോകനം",
      ayush_prakriti: "പ്രകൃതി", ayush_vikriti: "വികൃതി", ayush_agni: "അഗ്നി",
      ayush_koshtha: "കോഷ്ഠ", ayush_ahara_vihara: "ആഹാര-വിഹാര",
      ayush_nidana: "നിദാന", ayush_samprapti: "സംപ്രാപ്തി", summary: "സംഗ്രഹം",
    },
    pa: {
      chief_complaint: "ਸਮੱਸਿਆ", hpi: "ਵਰਤਮਾਨ ਬਿਮਾਰੀ",
      past_history: "ਪੁਰਾਣਾ ਇਤਿਹਾਸ", drug_allergy: "ਦਵਾਈ/ਐਲਰਜੀ",
      family_history: "ਪਰਿਵਾਰਕ ਇਤਿਹਾਸ", personal_history: "ਨਿੱਜੀ ਇਤਿਹਾਸ",
      review_of_systems: "ਅੰਗ ਸਮੀਖਿਆ",
      ayush_prakriti: "ਪ੍ਰਕਿਰਤੀ", ayush_vikriti: "ਵਿਕ੍ਰਿਤੀ", ayush_agni: "ਅਗਨੀ",
      ayush_koshtha: "ਕੋਸ਼ਠ", ayush_ahara_vihara: "ਆਹਾਰ-ਵਿਹਾਰ",
      ayush_nidana: "ਨਿਦਾਨ", ayush_samprapti: "ਸੰਪ੍ਰਾਪਤੀ", summary: "ਸਾਰ",
    },
    ur: {
      chief_complaint: "مسئلہ", hpi: "موجودہ بیماری",
      past_history: "سابقہ تاریخ", drug_allergy: "دوا/الرجی",
      family_history: "خاندانی تاریخ", personal_history: "ذاتی تاریخ",
      review_of_systems: "نظام کا جائزہ",
      ayush_prakriti: "پرکرتی", ayush_vikriti: "وکرتی", ayush_agni: "اگنی",
      ayush_koshtha: "کوشٹھ", ayush_ahara_vihara: "آہار-وہار",
      ayush_nidana: "نیدان", ayush_samprapti: "سمپراپتی", summary: "خلاصہ",
    },
  };
  return labels[lang] ?? labels["hi"];
}

// Touch option chips per stage
const TOUCH_OPTIONS: Partial<Record<Stage, string[]>> = {
  chief_complaint: ["बुखार / Fever", "दर्द / Pain", "उल्टी / Vomiting",
    "सांस / Breathing", "चक्कर / Dizziness", "कमज़ोरी / Weakness",
    "खांसी / Cough", "पेट / Stomach"],
  hpi: ["आज / Today", "2–3 दिन / 2–3 Days", "1 हफ्ता / 1 Week",
    "1 महीना / 1 Month", "जलन / Burning", "दबाव / Pressing", "हल्का / Mild", "तेज़ / Severe"],
  past_history: ["मधुमेह / Diabetes", "BP", "हृदय / Heart", "टीबी / TB",
    "ऑपरेशन / Surgery", "कुछ नहीं / Nothing"],
  drug_allergy: ["हाँ, दवाई / Yes, medicine", "नहीं / No", "पेनिसिलिन / Penicillin",
    "सल्फा / Sulfa", "Aspirin", "कुछ नहीं / Nothing"],
  family_history: ["मधुमेह / Diabetes", "BP", "हृदय / Heart", "कैंसर / Cancer",
    "टीबी / TB", "कुछ नहीं / Nothing"],
  personal_history: ["धूम्रपान / Smoking", "शराब / Alcohol", "तंबाकू / Tobacco",
    "शाकाहारी / Vegetarian", "नहीं / None"],
  review_of_systems: ["आँख / Eyes", "कान / Ears", "छाती / Chest", "पेट / Stomach",
    "जोड़ / Joints", "कोई नहीं / None"],
  ayush_prakriti: ["वात / Vata", "पित्त / Pitta", "कफ / Kapha", "वात-पित्त", "पित्त-कफ"],
  ayush_vikriti: ["बेचैन / Anxious", "गर्म / Hot", "भारीपन / Heavy"],
  ayush_agni: ["अनियमित / Irregular", "तेज़ / Strong", "धीमी / Slow"],
  ayush_koshtha: ["नियमित / Regular", "कभी-कभी / Occasional", "कब्ज़ / Constipated"],
  ayush_ahara_vihara: ["गर्म खाना / Hot food", "तीखा / Spicy", "देर से सोना / Late sleep"],
  ayush_nidana: ["तनाव / Stress", "ठंड / Cold", "बासी खाना / Stale food"],
  ayush_samprapti: ["खाने के बाद / After food", "सुबह / Morning", "रात / Night"],
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
          setStage(forStage); // sync breadcrumb to the question being ASKED, not the next stage
          setCurrentQuestion(data.question);
        }
      } catch {
        // Offline fallback — multilingual static questions per stage
        const OFFLINE_FALLBACKS: Record<string, Record<Stage, string>> = {
          hi: {
            chief_complaint: "आज आपको मुख्य रूप से क्या तकलीफ है?",
            hpi: "यह तकलीफ कब से है, कैसी है?",
            past_history: "क्या पहले कोई बड़ी बीमारी हुई है?",
            drug_allergy: "क्या आप कोई दवाई ले रहे हैं?",
            family_history: "परिवार में किसी को बड़ी बीमारी है?",
            personal_history: "आप क्या काम करते हैं? धूम्रपान/शराब?",
            review_of_systems: "किसी और अंग में तकलीफ है?",
            ayush_prakriti: "आपकी त्वचा कैसी है?",
            ayush_vikriti: "अभी कैसा महसूस कर रहे हैं?",
            ayush_agni: "भूख कैसी है?",
            ayush_koshtha: "पेट साफ कैसे होता है?",
            ayush_ahara_vihara: "आप क्या खाते हैं?",
            ayush_nidana: "तकलीफ से पहले क्या बदला?",
            ayush_samprapti: "तकलीफ कब बढ़ती है?",
            summary: "",
          },
          en: {
            chief_complaint: "What is your main problem today?",
            hpi: "When did it start, how does it feel?",
            past_history: "Any past major illness or surgery?",
            drug_allergy: "Any medicines or allergies?",
            family_history: "Family history of major diseases?",
            personal_history: "Occupation? Smoke or drink?",
            review_of_systems: "Any other body part issues?",
            ayush_prakriti: "How is your skin usually?",
            ayush_vikriti: "How do you feel now?",
            ayush_agni: "How is your appetite?",
            ayush_koshtha: "How is your bowel movement?",
            ayush_ahara_vihara: "What do you usually eat?",
            ayush_nidana: "What changed before this problem?",
            ayush_samprapti: "When does it worsen?",
            summary: "",
          },
          ta: {
            chief_complaint: "இன்று உங்கள் முக்கிய பிரச்சினை என்ன?",
            hpi: "இது எப்போது தொடங்கியது?",
            past_history: "முன்பு ஏதாவது பெரிய நோய் வந்ததுண்டா?",
            drug_allergy: "மருந்து அல்லது ஒவ்வாமை உள்ளதா?",
            family_history: "குடும்பத்தில் நோய் வரலாறு?",
            personal_history: "உங்கள் தொழில் என்ன?",
            review_of_systems: "வேறு உறுப்புகளில் பிரச்சனை?",
            ayush_prakriti: "உங்கள் தோல் எப்படி இருக்கும்?",
            ayush_vikriti: "இப்போது எப்படி உணர்கிறீர்கள்?",
            ayush_agni: "பசி எப்படி உள்ளது?",
            ayush_koshtha: "மலம் எப்படி?",
            ayush_ahara_vihara: "என்ன சாப்பிடுவீர்கள்?",
            ayush_nidana: "என்ன மாற்றம் ஏற்பட்டது?",
            ayush_samprapti: "எப்போது அதிகரிக்கிறது?",
            summary: "",
          },
          te: {
            chief_complaint: "ఈరోజు మీ ప్రధాన సమస్య ఏమిటి?",
            hpi: "ఇది ఎప్పుడు మొదలైంది?",
            past_history: "గతంలో ఏదైనా పెద్ద వ్యాధి వచ్చిందా?",
            drug_allergy: "మందులు లేదా అలర్జీ ఉందా?",
            family_history: "కుటుంబంలో వ్యాధుల చరిత్ర?",
            personal_history: "మీ వృత్తి ఏమిటి?",
            review_of_systems: "ఇతర భాగాల్లో సమస్య?",
            ayush_prakriti: "మీ చర్మం ఎలా ఉంటుంది?",
            ayush_vikriti: "ఇప్పుడు ఎలా అనిపిస్తోంది?",
            ayush_agni: "ఆకలి ఎలా ఉంది?",
            ayush_koshtha: "మలవిసర్జన ఎలా ఉంది?",
            ayush_ahara_vihara: "ఏమి తింటారు?",
            ayush_nidana: "ఏమి మారింది?",
            ayush_samprapti: "ఎప్పుడు పెరుగుతుంది?",
            summary: "",
          },
          bn: {
            chief_complaint: "আজ আপনার প্রধান সমস্যা কী?",
            hpi: "এটি কখন শুরু হয়েছে?",
            past_history: "আগে কোনো বড় রোগ হয়েছিল?",
            drug_allergy: "ওষুধ বা অ্যালার্জি?",
            family_history: "পরিবারে রোগের ইতিহাস?",
            personal_history: "আপনার পেশা কী?",
            review_of_systems: "অন্য অঙ্গে সমস্যা?",
            ayush_prakriti: "আপনার ত্বক কেমন?",
            ayush_vikriti: "এখন কেমন লাগছে?",
            ayush_agni: "ক্ষুধা কেমন?",
            ayush_koshtha: "মলত্যাগ কেমন?",
            ayush_ahara_vihara: "কী খান সাধারণত?",
            ayush_nidana: "কী পরিবর্তন হয়েছিল?",
            ayush_samprapti: "কখন বাড়ে?",
            summary: "",
          },
          mr: {
            chief_complaint: "आज तुमची मुख्य समस्या काय आहे?",
            hpi: "हा त्रास कधीपासून आहे?",
            past_history: "आधी काही मोठा आजार झाला होता का?",
            drug_allergy: "औषधे किंवा ॲलर्जी?",
            family_history: "कुटुंबात आजाराचा इतिहास?",
            personal_history: "तुमचा व्यवसाय काय?",
            review_of_systems: "इतर अवयवांत त्रास?",
            ayush_prakriti: "तुमची त्वचा कशी असते?",
            ayush_vikriti: "आत्ता कसे वाटते?",
            ayush_agni: "भूक कशी आहे?",
            ayush_koshtha: "मलशुद्धी कशी होते?",
            ayush_ahara_vihara: "काय खाता सहसा?",
            ayush_nidana: "काय बदलले?",
            ayush_samprapti: "केव्हा वाढतो त्रास?",
            summary: "",
          },
          gu: {
            chief_complaint: "આજે તમારી મુખ્ય સમસ્યા શું છે?",
            hpi: "આ ક્યારે શરૂ થઈ?",
            past_history: "પહેલા કોઈ મોટી બીમારી?",
            drug_allergy: "દવા કે એલર્જી?",
            family_history: "પરિવારમાં બીમારીઓ?",
            personal_history: "તમારો વ્યવસાય?",
            review_of_systems: "અન્ય ભાગોમાં તકલીફ?",
            ayush_prakriti: "ત્વચા કેવી?",
            ayush_vikriti: "હવે કેવું?",
            ayush_agni: "ભૂખ કેવી?",
            ayush_koshtha: "ઝાડા-સ્થિતિ?",
            ayush_ahara_vihara: "ખોરાક?",
            ayush_nidana: "પહેલા શું બદલ્યું?",
            ayush_samprapti: "ક્યારે વધે?",
            summary: "",
          },
          kn: {
            chief_complaint: "ಇಂದು ನಿಮ್ಮ ಮುಖ್ಯ ಸಮಸ್ಯೆ ಏನು?",
            hpi: "ಇದು ಯಾವಾಗ ಪ್ರಾರಂಭವಾಯಿತು?",
            past_history: "ಮೊದಲು ದೊಡ್ಡ ಕಾಯಿಲೆ ಬಂದಿತ್ತೇ?",
            drug_allergy: "ಔಷಧ ಅಥವಾ ಅಲರ್ಜಿ?",
            family_history: "ಕುಟುಂಬದ ಕಾಯಿಲೆ ಇತಿಹಾಸ?",
            personal_history: "ನಿಮ್ಮ ವೃತ್ತಿ ಏನು?",
            review_of_systems: "ಇತರ ಭಾಗಗಳಲ್ಲಿ ಸಮಸ್ಯೆ?",
            ayush_prakriti: "ಚರ್ಮ ಹೇಗಿದೆ?",
            ayush_vikriti: "ಈಗ ಹೇಗನಿಸಿದೆ?",
            ayush_agni: "ಹಸಿವು ಹೇಗಿದೆ?",
            ayush_koshtha: "ಮಲ ವಿಸರ್ಜನೆ?",
            ayush_ahara_vihara: "ಆಹಾರ?",
            ayush_nidana: "ಏನು ಬದಲಾಯಿತು?",
            ayush_samprapti: "ಯಾವಾಗ ಹೆಚ್ಚಾಗುತ್ತದೆ?",
            summary: "",
          },
          ml: {
            chief_complaint: "ഇന്ന് നിങ്ങളുടെ പ്രധാന പ്രശ്നം എന്താണ്?",
            hpi: "ഇത് എപ്പോൾ തുടങ്ങി?",
            past_history: "മുൻ വലിയ രോഗം ഉണ്ടായിരുന്നോ?",
            drug_allergy: "മരുന്ന് അല്ലെങ്കിൽ ആലർജി?",
            family_history: "കുടുംബ ചരിത്രം?",
            personal_history: "തൊഴിൽ?",
            review_of_systems: "ഇതര ഭാഗങ്ങളിൽ പ്രശ്നം?",
            ayush_prakriti: "ചർമം?",
            ayush_vikriti: "ഇപ്പോൾ?",
            ayush_agni: "വിശപ്പ്?",
            ayush_koshtha: "മലവിസർജ്ജനം?",
            ayush_ahara_vihara: "ഭക്ഷണം?",
            ayush_nidana: "മാറ്റം?",
            ayush_samprapti: "എപ്പോൾ?",
            summary: "",
          },
          pa: {
            chief_complaint: "ਅੱਜ ਤੁਹਾਡੀ ਮੁੱਖ ਸਮੱਸਿਆ ਕੀ ਹੈ?",
            hpi: "ਇਹ ਕਦੋਂ ਸ਼ੁਰੂ ਹੋਇਆ?",
            past_history: "ਪਹਿਲਾਂ ਕੋਈ ਵੱਡੀ ਬਿਮਾਰੀ?",
            drug_allergy: "ਦਵਾਈ ਜਾਂ ਐਲਰਜੀ?",
            family_history: "ਪਰਿਵਾਰ ਵਿੱਚ ਬਿਮਾਰੀਆਂ?",
            personal_history: "ਕੰਮ ਕੀ ਕਰਦੇ ਹੋ?",
            review_of_systems: "ਹੋਰ ਅੰਗਾਂ ਵਿੱਚ ਤਕਲੀਫ਼?",
            ayush_prakriti: "ਚਮੜੀ ਕਿਹੋ ਜਿਹੀ?",
            ayush_vikriti: "ਹੁਣ ਕਿਵੇਂ?",
            ayush_agni: "ਭੁੱਖ?",
            ayush_koshtha: "ਪੇਟ ਸਾਫ਼?",
            ayush_ahara_vihara: "ਖਾਣਾ?",
            ayush_nidana: "ਕੀ ਬਦਲਿਆ?",
            ayush_samprapti: "ਕਦੋਂ ਵਧਦਾ?",
            summary: "",
          },
        };
        const langFallbacks = OFFLINE_FALLBACKS[lang] ?? OFFLINE_FALLBACKS["hi"];
        setCurrentQuestion(langFallbacks[forStage]);
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
      setCurrentQuestion(""); // clear stale question while loading next
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
  const chips = TOUCH_OPTIONS[stage] ?? COMMON_SYMPTOMS.slice(0, 8).map((s) => s.labelHi);

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
              {i < stageIndex ? "✓" : i + 1} {getStageLabels(lang)[s]}
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
                <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center shrink-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.jpg" alt="MediKiosk" className="h-7 w-7 rounded-full object-cover" />
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
