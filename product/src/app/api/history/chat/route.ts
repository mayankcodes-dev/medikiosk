// src/app/api/history/chat/route.ts
// Gemini-powered adaptive clinical history-taking AI — RAG-enhanced.
// Generates the next clinical question using:
//   1. RAG context retrieved from clinical knowledge base
//   2. AYUSH Dashavidha Pariksha mode when requested
//   3. Red-flag detection via emergency RAG chunks
//   4. Fallback static questions when Gemini / RAG unavailable

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { embedText } from "@/lib/rag/embedder";
import {
  retrieveByVector,
  retrieveByKeyword,
  hasEmergencyTrigger,
  formatContextForLLM,
} from "@/lib/rag/retriever";
import type { KnowledgeDomain } from "@/lib/rag/knowledge-base";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const LANG_NAMES: Record<string, string> = {
  hi: "Hindi",   en: "English",    bn: "Bengali",   ta: "Tamil",
  te: "Telugu",  mr: "Marathi",    gu: "Gujarati",  kn: "Kannada",
  ml: "Malayalam", pa: "Punjabi",  ur: "Urdu",      or: "Odia",
  as: "Assamese", bo: "Bodo",      doi: "Dogri",    kok: "Konkani",
  mai: "Maithili", mni: "Manipuri", ne: "Nepali",   sa: "Sanskrit",
  sat: "Santali", sd: "Sindhi",    ks: "Kashmiri",  mni_mtei: "Meitei",
};

// ── Allopathic stages ────────────────────────────────────────────────────────
const ALLOPATHIC_STAGES = [
  "chief_complaint", "duration", "character", "severity",
  "associated_symptoms", "past_history", "medications", "summary",
] as const;

// ── AYUSH Dashavidha Pariksha stages ─────────────────────────────────────────
const AYUSH_STAGES = [
  "chief_complaint", "duration",
  "ayush_prakriti",      // Constitution assessment (Vata/Pitta/Kapha)
  "ayush_vikriti",       // Current dosha imbalance
  "ayush_agni",          // Digestive capacity
  "ayush_nidana",        // Causative factors (diet, lifestyle, seasonal)
  "ayush_purvarupa",     // Prodromal symptoms
  "past_history", "medications",
  "summary",
] as const;

type AllopathicStage = typeof ALLOPATHIC_STAGES[number];
type AyushStage = typeof AYUSH_STAGES[number];
export type Stage = AllopathicStage | AyushStage;
export type InterviewMode = "allopathic" | "ayush";

export interface ChatMessage {
  role: "ai" | "patient";
  text: string;
  stage?: Stage;
}

export interface ChatRequest {
  lang: string;
  messages: ChatMessage[];
  stage: Stage;
  mode?: InterviewMode;
  /** Chief complaint text (for RAG retrieval) */
  chiefComplaint?: string;
}

export interface ChatResponse {
  question: string;
  nextStage: Stage;
  isComplete: boolean;
  emergencyTriage?: boolean;
  ragChunksUsed?: number;
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
  // AYUSH-specific fields (populated in ayush mode)
  prakriti?: string;
  vikriti?: string;
  agniType?: string;
  nidana?: string;
}

// ── Stage sequencing ─────────────────────────────────────────────────────────

function getStageList(mode: InterviewMode): readonly Stage[] {
  return mode === "ayush" ? AYUSH_STAGES : ALLOPATHIC_STAGES;
}

function getNextStage(current: Stage, mode: InterviewMode): Stage {
  const stages = getStageList(mode);
  const idx = stages.indexOf(current as never);
  if (idx === -1 || idx >= stages.length - 1) return "summary";
  return stages[idx + 1];
}

function isLastQuestionStage(stage: Stage, mode: InterviewMode): boolean {
  const stages = getStageList(mode);
  // Stage just before "summary" triggers summary generation
  return stage === stages[stages.length - 2];
}

// ── RAG retrieval helper ──────────────────────────────────────────────────────

async function fetchRAGContext(
  query: string,
  domain: KnowledgeDomain | KnowledgeDomain[],
  k = 3
): Promise<{ context: string; emergencyTriage: boolean; chunksUsed: number }> {
  try {
    let results;
    if (process.env.GEMINI_API_KEY) {
      try {
        const embedding = await embedText(query);
        results = await retrieveByVector(embedding, { k, domain });
      } catch {
        results = await retrieveByKeyword(query, { k, domain });
      }
    } else {
      results = await retrieveByKeyword(query, { k, domain });
    }

    return {
      context: formatContextForLLM(results),
      emergencyTriage: hasEmergencyTrigger(results),
      chunksUsed: results.length,
    };
  } catch {
    return { context: "", emergencyTriage: false, chunksUsed: 0 };
  }
}

const LANG_SCRIPTS: Record<string, string> = {
  hi: "हिंदी (Devanagari)",    en: "English",
  bn: "বাংলা (Bengali)",       ta: "தமிழ் (Tamil)",
  te: "తెలుగు (Telugu)",        mr: "मराठी (Devanagari)",
  gu: "ગુજરાતી (Gujarati)",    kn: "ಕನ್ನಡ (Kannada)",
  ml: "മലയാളം (Malayalam)",    pa: "ਪੰਜਾਬੀ (Gurmukhi)",
  ur: "اردو (Nastaliq)",        or: "ଓଡ଼ିଆ (Odia)",
  as: "অসমীয়া (Assamese)",     bo: "བོད་སྐད། (Tibetan)",
  doi: "डोगरी (Devanagari)",   kok: "कोंकणी (Devanagari)",
  mai: "मैथिली (Devanagari)",  mni: "মণিপুরী (Bengali script)",
  ne: "नेपाली (Devanagari)",   sa: "संस्कृत (Devanagari)",
  sat: "ᱥᱟᱱᱛᱟᱲᱤ (Ol Chiki)", sd: "سنڌي (Khudawadi)",
  ks: "کٲشُر (Nastaliq)",       mni_mtei: "ꯃꯤꯇꯩ (Meitei Mayek)",
};

function buildSystemPrompt(
  lang: string,
  mode: InterviewMode,
  ragContext: string
): string {
  const langName = LANG_NAMES[lang] ?? "Hindi";
  const langScript = LANG_SCRIPTS[lang] ?? langName;
  const modeDesc =
    mode === "ayush"
      ? "an Ayurvedic (AYUSH) medical assistant following Dashavidha Pariksha"
      : "a clinical history-taking assistant following the SOCRATES framework";

  const ragSection = ragContext
    ? `\n\n--- CLINICAL KNOWLEDGE (use this to guide your question) ---\n${ragContext}\n--- END CLINICAL KNOWLEDGE ---`
    : "";

  return `You are MediKiosk — ${modeDesc} deployed at Indian government hospitals.

ROLE: Gather clinical history from patients BEFORE they see the doctor. You are NOT diagnosing.

LANGUAGE (CRITICAL): You MUST respond ONLY in ${langName} (${langScript}).
- NEVER use English words unless there is no equivalent in ${langName}
- Write ONLY in the native script for ${langName}
- If the patient writes in another language, still reply in ${langName}
- Medical terms may be simplified to everyday ${langName} words
- Every single response must be in ${langName} script, not transliterated Roman

STYLE:
- Ask ONE question at a time
- Keep every question SHORT (under 12 words in ${langName})
- Use simple, warm, empathetic words a village patient can understand
- For the SUMMARY stage, return ONLY valid JSON — no other text${ragSection}`;
}

// ── Summary prompt ────────────────────────────────────────────────────────────

function buildSummaryPrompt(
  messages: ChatMessage[],
  mode: InterviewMode
): string {
  const conversationText = messages
    .map((m) => `${m.role === "ai" ? "Doctor" : "Patient"}: ${m.text}`)
    .join("\n");

  const ayushFields =
    mode === "ayush"
      ? `
  "prakriti": "Vata/Pitta/Kapha constitution based on patient's answers",
  "vikriti": "current dosha imbalance",
  "agniType": "Sama/Vishama/Tikshna/Manda",
  "nidana": "causative factors identified",`
      : "";

  return `Based on this clinical conversation, generate a structured medical summary.
Return ONLY valid JSON. No extra text, no markdown fences.

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
  "suggestedICD10": "ICD-10 code + name (best guess)",
  "redFlags": ["urgent symptoms needing immediate attention — empty array if none"],
  "ayushNote": "AYUSH-specific clinical note or Dashavidha Pariksha findings"${ayushFields}
}`;
}

// ── Gemini call helper ────────────────────────────────────────────────────────

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const modelsToTry = [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ].filter(Boolean) as string[];

  for (const model of modelsToTry) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await ai.models.generateContent({
        model,
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Understood. I will ask one question at a time in the patient's language." }] },
          { role: "user", parts: [{ text: userPrompt }] },
        ],
      });
      if (response?.text) return response.text.trim();
    } catch {
      // try next model
    }
  }
  return null;
}

// ── Fallback questions ────────────────────────────────────────────────────────

const FALLBACK_QUESTIONS: Partial<Record<Stage, Record<string, string>>> = {
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
  // AYUSH-specific fallbacks
  ayush_prakriti: {
    hi: "आपकी त्वचा सामान्यतः कैसी है — रूखी, गर्म-तैलीय, या ठंडी-मुलायम?",
    en: "Is your skin usually dry, warm and oily, or cool and smooth?",
    bn: "আপনার ত্বক সাধারণত কেমন — শুষ্ক, উষ্ণ-তৈলাক্ত, বা শীতল-মসৃণ?",
    ta: "உங்கள் தோல் பொதுவாக எப்படி — உலர்ந்த, சூடான-எண்ணெய், அல்லது குளிர்-மென்மை?",
  },
  ayush_vikriti: {
    hi: "अभी आप कैसा महसूस कर रहे हैं — बेचैन, गर्म/जलन, या भारीपन?",
    en: "How do you feel now — restless/anxious, hot/burning, or heavy/sluggish?",
    bn: "এখন আপনি কেমন অনুভব করছেন — অস্থির, গরম/জ্বালা, বা ভারী?",
    ta: "இப்போது நீங்கள் எப்படி உணர்கிறீர்கள் — பதட்டம், சூடு/எரிச்சல், அல்லது கனம்?",
  },
  ayush_agni: {
    hi: "आपकी भूख कैसी है — अनियमित, बहुत तेज़, या धीमी?",
    en: "How is your appetite — irregular, very strong, or slow and low?",
    bn: "আপনার ক্ষুধা কেমন — অনিয়মিত, খুব তীব্র, বা ধীরগতি?",
    ta: "உங்கள் பசி எப்படி — ஒழுங்கற்ற, மிகவும் வலுவான, அல்லது மெதுவான?",
  },
  ayush_nidana: {
    hi: "यह तकलीफ शुरू होने से पहले आप क्या खा रहे थे या क्या कर रहे थे?",
    en: "Before this problem started, what were you eating or doing differently?",
    bn: "এই সমস্যা শুরু হওয়ার আগে আপনি কী খাচ্ছিলেন বা করছিলেন?",
    ta: "இந்த பிரச்சனை தொடங்கும் முன், நீங்கள் என்ன சாப்பிட்டீர்கள் அல்லது செய்தீர்கள்?",
  },
  ayush_purvarupa: {
    hi: "मुख्य तकलीफ से पहले कोई हल्के संकेत — जैसे थकान, अपच, नींद में बदलाव?",
    en: "Before the main problem, any early signs like fatigue, indigestion, or sleep changes?",
    bn: "মূল সমস্যার আগে কোনো প্রাথমিক লক্ষণ — ক্লান্তি, বদহজম, ঘুমের পরিবর্তন?",
    ta: "முக்கிய பிரச்சனைக்கு முன், களைப்பு, செரிமான கோளாறு, தூக்கம் மாற்றம் போன்ற அறிகுறிகள்?",
  },
  summary: { hi: "", en: "", bn: "", ta: "", te: "", mr: "", gu: "", kn: "", ml: "", pa: "", ur: "" },
};

function getFallbackQuestion(stage: Stage, lang: string): string {
  const stageQ = FALLBACK_QUESTIONS[stage];
  return stageQ?.[lang] ?? stageQ?.["hi"] ?? "आपको क्या तकलीफ है?";
}

// ── Determine RAG domain for a stage ─────────────────────────────────────────

function getRAGDomain(stage: Stage, mode: InterviewMode): KnowledgeDomain[] {
  if (mode === "ayush") return ["ayush"];
  if (stage === "chief_complaint" || stage === "associated_symptoms") {
    return ["allopathic", "emergency"];
  }
  if (stage === "medications") return ["drug"];
  return ["allopathic"];
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { lang, messages, stage, mode = "allopathic", chiefComplaint } = body;

    const nextStage = getNextStage(stage, mode);
    const isComplete = isLastQuestionStage(stage, mode);

    // ── Emergency detection on incoming messages ──────────────────────────
    // If the last patient message contains a red-flag keyword, run emergency RAG
    const lastPatientMsg = [...messages].reverse().find((m) => m.role === "patient")?.text ?? "";
    let globalEmergency = false;

    if (lastPatientMsg.length > 3) {
      const emergencyRag = await fetchRAGContext(
        lastPatientMsg,
        ["emergency"],
        2
      );
      globalEmergency = emergencyRag.emergencyTriage;
    }

    // ── Summary stage — generate structured JSON ──────────────────────────
    if (stage === "summary" || isComplete) {
      const summaryPrompt = buildSummaryPrompt(messages, mode);
      try {
        const modelsToTry = [
          process.env.GEMINI_MODEL,
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-flash",
        ].filter(Boolean) as string[];

        let raw = "{}";
        for (const model of modelsToTry) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const resp: any = await ai.models.generateContent({ model, contents: summaryPrompt });
            if (resp?.text) { raw = resp.text; break; }
          } catch { /* try next */ }
        }

        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const structuredSummary: StructuredSummary = JSON.parse(cleaned);
        return NextResponse.json({
          question: "",
          nextStage: "summary",
          isComplete: true,
          emergencyTriage: globalEmergency || (structuredSummary.redFlags?.length ?? 0) > 0,
          structuredSummary,
        } satisfies ChatResponse);
      } catch {
        // Fallback summary from individual stage answers
        const byStage = (s: Stage) =>
          messages.find((m) => m.stage === s)?.text ?? "Not recorded";
        const fallback: StructuredSummary = {
          chiefComplaint: byStage("chief_complaint"),
          duration: byStage("duration"),
          severity: byStage("severity"),
          character: "character" in FALLBACK_QUESTIONS ? byStage("character" as Stage) : "Not recorded",
          associatedSymptoms: [],
          pastHistory: byStage("past_history"),
          currentMedications: byStage("medications"),
          suggestedICD10: "R00-R99 — Symptoms and signs",
          redFlags: [],
          ayushNote: mode === "ayush"
            ? `Prakriti: ${byStage("ayush_prakriti")}. Agni: ${byStage("ayush_agni")}.`
            : "Requires Dashavidha Pariksha for complete AYUSH assessment.",
          ...(mode === "ayush" ? {
            prakriti: byStage("ayush_prakriti"),
            vikriti: byStage("ayush_vikriti"),
            agniType: byStage("ayush_agni"),
            nidana: byStage("ayush_nidana"),
          } : {}),
        };
        return NextResponse.json({
          question: "", nextStage: "summary", isComplete: true,
          emergencyTriage: globalEmergency, structuredSummary: fallback,
        } satisfies ChatResponse);
      }
    }

    // ── Question stage — retrieve RAG context then ask Gemini ─────────────
    const ragQuery = chiefComplaint
      ? `${chiefComplaint} ${stage.replace(/_/g, " ")}`
      : `${stage.replace(/_/g, " ")} clinical history question`;

    const rag = await fetchRAGContext(ragQuery, getRAGDomain(stage, mode), 3);
    const systemPrompt = buildSystemPrompt(lang, mode, rag.context);

    const conversationHistory = messages
      .map((m) => `${m.role === "ai" ? "AI" : "Patient"}: ${m.text}`)
      .join("\n");

    const stageLabel = mode === "ayush"
      ? stage.replace("ayush_", "Dashavidha — ")
      : stage;

    const userPrompt = `Current stage: ${stageLabel}
Mode: ${mode}
Conversation so far:
${conversationHistory || "(No conversation yet — this is the first question)"}

Ask the next question for this stage. Reply with ONLY the question in ${LANG_NAMES[lang] ?? "Hindi"}. No explanation, no prefix.`;

    const geminiResponse = await callGemini(systemPrompt, userPrompt);
    const question = geminiResponse ?? getFallbackQuestion(stage, lang);

    return NextResponse.json({
      question,
      nextStage,
      isComplete: false,
      emergencyTriage: globalEmergency || rag.emergencyTriage,
      ragChunksUsed: rag.chunksUsed,
    } satisfies ChatResponse);

  } catch (err) {
    console.error("[history/chat] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
