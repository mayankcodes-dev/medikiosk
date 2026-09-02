// src/app/api/history/chat/route.ts
// Gemini-powered adaptive clinical history-taking AI
// Generates the next clinical question based on conversation so far.
// Falls back to structured mock questions if Gemini is unavailable.

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Language → full name for the prompt
const LANG_NAMES: Record<string, string> = {
  hi: "Hindi", en: "English", bn: "Bengali", ta: "Tamil",
  te: "Telugu", mr: "Marathi", gu: "Gujarati", kn: "Kannada",
  ml: "Malayalam", pa: "Punjabi", ur: "Urdu", or: "Odia", as: "Assamese",
};

// Clinical history stages
const HISTORY_STAGES = [
  "chief_complaint",
  "duration",
  "character",
  "severity",
  "associated_symptoms",
  "past_history",
  "medications",
  "summary",
] as const;

type Stage = typeof HISTORY_STAGES[number];

export interface ChatMessage {
  role: "ai" | "patient";
  text: string;
  stage?: Stage;
}

export interface ChatRequest {
  lang: string;
  messages: ChatMessage[];
  stage: Stage;
}

export interface ChatResponse {
  question: string;
  nextStage: Stage;
  isComplete: boolean;
  structuredSummary?: StructuredSummary;
}

export interface StructuredSummary {
  chiefComplaint: string;
  duration: string;
  severity: string;
  character: string;
  associatedSymptoms: string[];
  pastHistory: string;
  currentMedications: string;
  suggestedICD10: string;
  redFlags: string[];
  ayushNote: string;
}

// ── System prompt for clinical AI ───────────────────────────────
function buildSystemPrompt(lang: string): string {
  const langName = LANG_NAMES[lang] ?? "Hindi";
  return `You are MediKiosk — an AI medical history-taking assistant deployed at Indian government hospitals and AYUSH clinics.

ROLE: You gather clinical history from patients BEFORE they see the doctor. You are NOT diagnosing — you are collecting structured information.

LANGUAGE: Respond ONLY in ${langName}. Keep every question SHORT (under 12 words). Use simple everyday words — no medical jargon. Speak as if talking to a semi-literate rural patient.

PROTOCOL: Follow this sequence strictly:
1. Chief complaint (main problem today)
2. Duration (how long)
3. Character (describe the pain/problem — burning, pressing, sharp, etc.)
4. Severity (on scale 1–10, or mild/moderate/severe)
5. Associated symptoms (any other problems like fever, vomiting, etc.)
6. Past history (any old illness, surgery, hospitalisation)
7. Medications (any medicines currently taking)
8. Generate structured summary (JSON only)

RULES:
- Ask ONE question at a time
- Never ask two things in one question
- If the patient's answer is unclear, gently ask to clarify — once only
- Use empathetic language: "आपको..." / "क्या आपने..." etc.
- For the SUMMARY stage, return ONLY valid JSON with this schema:
  {
    "chiefComplaint": "string",
    "duration": "string",
    "severity": "string",
    "character": "string",
    "associatedSymptoms": ["string"],
    "pastHistory": "string",
    "currentMedications": "string",
    "suggestedICD10": "string (best guess ICD-10 code and name)",
    "redFlags": ["string (any concerning symptoms that need urgent attention)"],
    "ayushNote": "string (AYUSH-specific note — Prakriti implications if relevant)"
  }`;
}

// ── Next stage logic ─────────────────────────────────────────────
function getNextStage(current: Stage): Stage {
  const idx = HISTORY_STAGES.indexOf(current);
  if (idx === -1 || idx >= HISTORY_STAGES.length - 1) return "summary";
  return HISTORY_STAGES[idx + 1];
}

// ── Fallback questions when Gemini is unavailable ────────────────
const FALLBACK_QUESTIONS: Record<Stage, Record<string, string>> = {
  chief_complaint: {
    hi: "आज आपको मुख्य रूप से क्या तकलीफ है?",
    en: "What is your main problem today?",
    bn: "আজ আপনার প্রধান সমস্যা কী?",
    ta: "இன்று உங்கள் முக்கிய பிரச்சனை என்ன?",
    te: "ఈ రోజు మీ ప్రధాన సమస్య ఏమిటి?",
    mr: "आज तुम्हाला मुख्य त्रास काय आहे?",
    gu: "આજે તમારી મુખ્ય ફરિયાદ શું છે?",
    kn: "ಇಂದು ನಿಮ್ಮ ಮುಖ್ಯ ಸಮಸ್ಯೆ ಏನು?",
    ml: "ഇന്ന് നിങ്ങളുടെ പ്രധാന പ്രശ്നം എന്താണ്?",
    pa: "ਅੱਜ ਤੁਹਾਨੂੰ ਮੁੱਖ ਕੀ ਤਕਲੀਫ਼ ਹੈ?",
    ur: "آج آپ کی اہم تکلیف کیا ہے؟",
  },
  duration: {
    hi: "यह तकलीफ कितने दिनों से है?",
    en: "How many days have you had this problem?",
    bn: "এই সমস্যা কতদিন ধরে আছে?",
    ta: "இந்த பிரச்சனை எத்தனை நாட்களாக உள்ளது?",
    te: "ఈ సమస్య ఎన్ని రోజుల నుండి ఉంది?",
    mr: "हा त्रास किती दिवसांपासून आहे?",
    gu: "આ તકલીફ કેટલા દિવસથી છે?",
    kn: "ಈ ಸಮಸ್ಯೆ ಎಷ್ಟು ದಿನಗಳಿಂದ ಇದೆ?",
    ml: "ഈ പ്രശ്നം എത്ര ദിവസമായി ഉണ്ട്?",
    pa: "ਇਹ ਤਕਲੀਫ਼ ਕਿੰਨੇ ਦਿਨਾਂ ਤੋਂ ਹੈ?",
    ur: "یہ تکلیف کتنے دنوں سے ہے؟",
  },
  character: {
    hi: "दर्द या तकलीफ कैसी है — जलन, दबाव, या चुभन?",
    en: "Describe the pain — burning, pressing, or sharp?",
    bn: "ব্যথা কেমন — জ্বালা, চাপ, নাকি তীক্ষ্ণ?",
    ta: "வலி எப்படி உள்ளது — எரிச்சல், அழுத்தம், கூர்மை?",
    te: "నొప్పి ఎలా ఉంది — మంట, ఒత్తిడి, లేదా పదునుగా?",
    mr: "वेदना कशी आहे — जळजळ, दाब, किंवा टोचणे?",
    gu: "દર્દ કેવું છે — બળતરા, દબાણ, કે ટોચ?",
    kn: "ನೋವು ಹೇಗಿದೆ — ಉರಿ, ಒತ್ತಡ, ಅಥವಾ ಚೂಪಾದ?",
    ml: "വേദന എങ്ങനെ — കത്ത്, ഞെക്ക്, കുത്ത്?",
    pa: "ਦਰਦ ਕਿਵੇਂ ਹੈ — ਜਲਣ, ਦਬਾਅ, ਜਾਂ ਚੁਭਣ?",
    ur: "درد کیسا ہے — جلن، دباؤ، یا چبھن؟",
  },
  severity: {
    hi: "दर्द कितना तेज़ है — हल्का, मध्यम, या बहुत तेज़?",
    en: "How bad is the pain — mild, moderate, or severe?",
    bn: "ব্যথা কতটা তীব্র — হালকা, মাঝারি, নাকি তীব্র?",
    ta: "வலி எவ்வளவு — லேசான, மிதமான, கடுமையான?",
    te: "నొప్పి ఎంత తీవ్రంగా ఉంది — తేలికగా, మధ్యంగా, లేదా చాలా?",
    mr: "वेदना किती तीव्र आहे — सौम्य, मध्यम, किंवा तीव्र?",
    gu: "દર્દ કેટલું તીવ્ર છે — હળવું, મધ્યમ, કે ઘણું?",
    kn: "ನೋವು ಎಷ್ಟು ತೀವ್ರ — ಸೌಮ್ಯ, ಮಧ್ಯಮ, ತೀಕ್ಷ್ಣ?",
    ml: "വേദന എത്ര കഠിനം — ലഘു, മിതം, കഠിനം?",
    pa: "ਦਰਦ ਕਿੰਨਾ ਤੇਜ਼ ਹੈ — ਹਲਕਾ, ਮੱਧਮ, ਜਾਂ ਬਹੁਤ?",
    ur: "درد کتنا شدید ہے — ہلکا، درمیانہ، یا شدید؟",
  },
  associated_symptoms: {
    hi: "क्या साथ में बुखार, उल्टी, या कोई और तकलीफ है?",
    en: "Any fever, vomiting, or other symptoms alongside?",
    bn: "সাথে জ্বর, বমি বা অন্য সমস্যা আছে?",
    ta: "காய்ச்சல், வாந்தி, அல்லது வேறு அறிகுறிகள் உள்ளதா?",
    te: "జ్వరం, వాంతి, లేదా ఇతర లక్షణాలు ఉన్నాయా?",
    mr: "सोबत ताप, उलट्या किंवा इतर त्रास आहे का?",
    gu: "સાથે તાવ, ઉલ્ટી, કે બીજી કોઈ તકલીફ છે?",
    kn: "ಜ್ವರ, ವಾಂತಿ, ಅಥವಾ ಇತರ ಲಕ್ಷಣಗಳು ಇವೆಯೇ?",
    ml: "പനി, ഛർദ്ദി, മറ്റ് ലക്ഷണങ്ങൾ ഉണ്ടോ?",
    pa: "ਨਾਲ ਬੁਖਾਰ, ਉਲਟੀ, ਜਾਂ ਹੋਰ ਤਕਲੀਫ਼ ਹੈ?",
    ur: "ساتھ بخار، قے، یا کوئی اور تکلیف ہے؟",
  },
  past_history: {
    hi: "क्या पहले कोई बड़ी बीमारी या ऑपरेशन हुआ है?",
    en: "Any past illness or surgery before?",
    bn: "আগে কোনো বড় অসুস্থতা বা অপারেশন হয়েছে?",
    ta: "முன்பு எந்த நோய் அல்லது அறுவை சிகிச்சை இருந்ததா?",
    te: "ముందు ఏదైనా పెద్ద అనారోగ్యం లేదా శస్త్రచికిత్స జరిగిందా?",
    mr: "आधी कोणताही मोठा आजार किंवा ऑपरेशन झाले आहे का?",
    gu: "પહેલાં કોઈ મોટી બીમારી કે ઓપરેશન થઈ છે?",
    kn: "ಮೊದಲು ಯಾವುದಾದರೂ ದೊಡ್ಡ ಕಾಯಿಲೆ ಅಥವಾ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ ಆಗಿದೆಯೇ?",
    ml: "മുൻപ് വലിയ രോഗം അല്ലെങ്കിൽ ശസ്ത്രക്രിയ ഉണ്ടായിരുന്നോ?",
    pa: "ਪਹਿਲਾਂ ਕੋਈ ਵੱਡੀ ਬਿਮਾਰੀ ਜਾਂ ਓਪਰੇਸ਼ਨ ਹੋਇਆ ਹੈ?",
    ur: "پہلے کوئی بڑی بیماری یا آپریشن ہوا ہے؟",
  },
  medications: {
    hi: "क्या आप अभी कोई दवाई ले रहे हैं?",
    en: "Are you currently taking any medicines?",
    bn: "আপনি কি এখন কোনো ওষুধ নিচ্ছেন?",
    ta: "நீங்கள் இப்போது ஏதாவது மருந்து எடுக்கிறீர்களா?",
    te: "మీరు ప్రస్తుతం ఏదైనా మందులు తీసుకుంటున్నారా?",
    mr: "तुम्ही सध्या कोणती औषधे घेत आहात का?",
    gu: "શું તમે અત્યારે કોઈ દવા લઈ રહ્યા છો?",
    kn: "ನೀವು ಈಗ ಯಾವುದಾದರೂ ಔಷಧಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದ್ದೀರಾ?",
    ml: "നിങ്ങൾ ഇപ്പോൾ എന്തെങ്കിലും മരുന്ന് കഴിക്കുന്നുണ്ടോ?",
    pa: "ਕੀ ਤੁਸੀਂ ਹੁਣ ਕੋਈ ਦਵਾਈ ਲੈ ਰਹੇ ਹੋ?",
    ur: "کیا آپ ابھی کوئی دوائی لے رہے ہیں؟",
  },
  summary: {
    hi: "", en: "", bn: "", ta: "", te: "",
    mr: "", gu: "", kn: "", ml: "", pa: "", ur: "",
  },
};

// ── POST handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { lang, messages, stage } = body;

    const nextStage = getNextStage(stage);
    const isComplete = stage === "medications";

    // ── Summary stage — generate structured SOAP JSON ────────────
    if (stage === "summary" || isComplete) {
      const conversationText = messages
        .map((m) => `${m.role === "ai" ? "Doctor" : "Patient"}: ${m.text}`)
        .join("\n");

      const summaryPrompt = `Based on this clinical conversation, generate a structured medical summary.
Return ONLY valid JSON. No extra text.

Conversation:
${conversationText}

JSON Schema:
{
  "chiefComplaint": "one line summary",
  "duration": "string",
  "severity": "mild|moderate|severe",
  "character": "string",
  "associatedSymptoms": ["array of strings"],
  "pastHistory": "string or 'None reported'",
  "currentMedications": "string or 'None'",
  "suggestedICD10": "ICD-10 code + name",
  "redFlags": ["urgent symptoms needing immediate attention"],
  "ayushNote": "AYUSH-specific clinical note"
}`;

      try {
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
          contents: summaryPrompt,
        });
        const raw = response.text ?? "{}";
        // Strip markdown code fences if present
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const structuredSummary: StructuredSummary = JSON.parse(cleaned);
        return NextResponse.json({
          question: "",
          nextStage: "summary",
          isComplete: true,
          structuredSummary,
        } as ChatResponse);
      } catch {
        // Fallback summary
        const fallback: StructuredSummary = {
          chiefComplaint: messages.find((m) => m.stage === "chief_complaint")?.text ?? "Not recorded",
          duration: messages.find((m) => m.stage === "duration")?.text ?? "Not recorded",
          severity: messages.find((m) => m.stage === "severity")?.text ?? "Not recorded",
          character: messages.find((m) => m.stage === "character")?.text ?? "Not recorded",
          associatedSymptoms: [],
          pastHistory: messages.find((m) => m.stage === "past_history")?.text ?? "Not recorded",
          currentMedications: messages.find((m) => m.stage === "medications")?.text ?? "None",
          suggestedICD10: "R00-R99 — Symptoms and signs",
          redFlags: [],
          ayushNote: "Requires Dashavidha Pariksha for complete AYUSH assessment.",
        };
        return NextResponse.json({ question: "", nextStage: "summary", isComplete: true, structuredSummary: fallback });
      }
    }

    // ── Question stage — ask next clinical question via Gemini ────
    const conversationHistory = messages
      .map((m) => `${m.role === "ai" ? "AI" : "Patient"}: ${m.text}`)
      .join("\n");

    const userPrompt = `Current stage: ${stage}
Conversation so far:
${conversationHistory || "(No conversation yet — this is the first question)"}

Ask the next question for stage "${stage}". Reply with ONLY the question in ${LANG_NAMES[lang] ?? "Hindi"}. No explanation, no prefix.`;

    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
        contents: [
          { role: "user", parts: [{ text: buildSystemPrompt(lang) }] },
          { role: "model", parts: [{ text: "Understood. I will ask one question at a time in the patient's language." }] },
          { role: "user", parts: [{ text: userPrompt }] },
        ],
      });

      const question = response.text?.trim() ?? getFallbackQuestion(stage, lang);
      return NextResponse.json({ question, nextStage, isComplete: false } as ChatResponse);
    } catch {
      // Fallback to static question
      const question = getFallbackQuestion(stage, lang);
      return NextResponse.json({ question, nextStage, isComplete: false } as ChatResponse);
    }
  } catch (err) {
    console.error("[history/chat] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getFallbackQuestion(stage: Stage, lang: string): string {
  const stageQ = FALLBACK_QUESTIONS[stage];
  return stageQ?.[lang] ?? stageQ?.["hi"] ?? "आपको क्या तकलीफ है?";
}
