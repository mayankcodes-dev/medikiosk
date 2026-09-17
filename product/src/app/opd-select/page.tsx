"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  KioskHeader,
  KioskScreen,
  KioskBody,
  KioskFooter,
} from "@/components/kiosk/KioskLayout";
import { Button, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { t, getLangName } from "@/lib/translations";
import { usePageSpeaker } from "@/hooks/usePageSpeaker";

type OPDMode = "allopathic" | "ayush";

// Local translations for the new specific strings to keep translation file clean
const LOCAL_TRANS: Record<string, Record<string, string>> = {
  en: {
    title: "Choose OPD Type",
    generalOpd: "General OPD",
    generalOpdDesc: "Standard allopathic clinical history taking",
    ayushOpd: "AYUSH OPD",
    ayushOpdDesc: "Includes Dashavidha Pariksha for Ayurvedic assessment",
    listenBtn: "Listen",
  },
  hi: {
    title: "OPD का प्रकार चुनें",
    generalOpd: "सामान्य OPD",
    generalOpdDesc: "एलोपैथिक क्लिनिकल इतिहास",
    ayushOpd: "आयुष OPD",
    ayushOpdDesc: "आयुर्वेदिक मूल्यांकन के लिए दशविध परीक्षा शामिल है",
    listenBtn: "सुनें",
  },
  bn: {
    title: "OPD প্রকার নির্বাচন করুন",
    generalOpd: "সাধারণ OPD",
    generalOpdDesc: "স্ট্যান্ডার্ড অ্যালোপ্যাথিক ক্লিনিকাল ইতিহাস গ্রহণ",
    ayushOpd: "আয়ুষ OPD",
    ayushOpdDesc: "আয়ুর্বেদিক মূল্যায়নের জন্য দশবিধ পরীক্ষা অন্তর্ভুক্ত",
    listenBtn: "শুনুন",
  },
  ta: {
    title: "OPD வகையைத் தேர்ந்தெடுக்கவும்",
    generalOpd: "பொது OPD",
    generalOpdDesc: "நிலையான அலோபதி மருத்துவ வரலாறு",
    ayushOpd: "ஆயுஷ் OPD",
    ayushOpdDesc: "ஆயுர்வேத மதிப்பீட்டிற்கான தசவித பரிக்ஷா அடங்கும்",
    listenBtn: "கேள்",
  },
  te: {
    title: "OPD రకాన్ని ఎంచుకోండి",
    generalOpd: "సాధారణ OPD",
    generalOpdDesc: "ప్రామాణిక అలోపతిక్ క్లినికల్ హిస్టరీ",
    ayushOpd: "ఆయుష్ OPD",
    ayushOpdDesc: "ఆయుర్వేద అంచనా కోసం దశవిద పరీక్షను కలిగి ఉంటుంది",
    listenBtn: "వినండి",
  },
  mr: {
    title: "OPD प्रकार निवडा",
    generalOpd: "सामान्य OPD",
    generalOpdDesc: "प्रमाणित ॲलोपॅथिक वैद्यकीय इतिहास",
    ayushOpd: "आयुष OPD",
    ayushOpdDesc: "आयुर्वेदिक मूल्यांकनासाठी दशविध परीक्षा समाविष्ट आहे",
    listenBtn: "ऐका",
  },
  gu: {
    title: "OPD નો પ્રકાર પસંદ કરો",
    generalOpd: "સામાન્ય OPD",
    generalOpdDesc: "પ્રમાણભૂત એલોપેથિક ક્લિનિકલ ઇતિહાસ",
    ayushOpd: "આયુષ OPD",
    ayushOpdDesc: "આયુર્વેદિક મૂલ્યાંકન માટે દશવિધ પરીક્ષા શામેલ છે",
    listenBtn: "સાંભળો",
  },
  kn: {
    title: "OPD ಪ್ರಕಾರವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    generalOpd: "ಸಾಮಾನ್ಯ OPD",
    generalOpdDesc: "ಸ್ಟ್ಯಾಂಡರ್ಡ್ ಅಲೋಪತಿಕ್ ಕ್ಲಿನಿಕಲ್ ಇತಿಹಾಸ",
    ayushOpd: "ಆಯುಷ್ OPD",
    ayushOpdDesc: "ಆಯುರ್ವೇದ ಮೌಲ್ಯಮಾಪನಕ್ಕಾಗಿ ದಶವಿಧ ಪರೀಕ್ಷೆಯನ್ನು ಒಳಗೊಂಡಿದೆ",
    listenBtn: "ಆಲಿಸಿ",
  },
  ml: {
    title: "OPD തരം തിരഞ്ഞെടുക്കുക",
    generalOpd: "ജനറൽ OPD",
    generalOpdDesc: "സ്റ്റാൻഡേർഡ് അലോപ്പതിക് ക്ലിനിക്കൽ ചരിത്രം",
    ayushOpd: "ആയുഷ് OPD",
    ayushOpdDesc: "ആയുർവേദ വിലയിരുത്തലിനുള്ള ദശവിധ പരീക്ഷ ഉൾപ്പെടുന്നു",
    listenBtn: "കേൾക്കുക",
  },
  pa: {
    title: "OPD ਦੀ ਕਿਸਮ ਚੁਣੋ",
    generalOpd: "ਆਮ OPD",
    generalOpdDesc: "ਸਟੈਂਡਰਡ ਐਲੋਪੈਥਿਕ ਕਲੀਨਿਕਲ ਇਤਿਹਾਸ",
    ayushOpd: "ਆਯੂਸ਼ OPD",
    ayushOpdDesc: "ਆਯੁਰਵੈਦਿਕ ਮੁਲਾਂਕਣ ਲਈ ਦਸ਼ਵਿਧ ਪ੍ਰੀਖਿਆ ਸ਼ਾਮਲ ਹੈ",
    listenBtn: "ਸੁਣੋ",
  },
  ur: {
    title: "OPD کی قسم منتخب کریں",
    generalOpd: "جنرل OPD",
    generalOpdDesc: "معیاری ایلوپیتھک طبی تاریخ",
    ayushOpd: "آیوش OPD",
    ayushOpdDesc: "آیورویدک تشخیص کے لیے دشاودھا پریکشا شامل ہے",
    listenBtn: "سنیں",
  },
  or: {
    title: "OPD ପ୍ରକାର ବାଛନ୍ତୁ",
    generalOpd: "ସାଧାରଣ OPD",
    generalOpdDesc: "ଷ୍ଟାଣ୍ଡାର୍ଡ ଆଲୋପାଥିକ୍ କ୍ଲିନିକାଲ୍ ଇତିହାସ",
    ayushOpd: "ଆୟୁଷ OPD",
    ayushOpdDesc: "ଆୟୁର୍ବେଦିକ୍ ମୂଲ୍ୟାଙ୍କନ ପାଇଁ ଦଶବିଧ ପରୀକ୍ଷା ଅନ୍ତର୍ଭୁକ୍ତ କରେ",
    listenBtn: "ଶୁଣନ୍ତୁ",
  },
  as: {
    title: "OPD প্ৰকাৰ বাছনি কৰক",
    generalOpd: "সাধাৰণ OPD",
    generalOpdDesc: "ষ্টেণ্ডাৰ্ড এলোপেথিক ক্লিনিকেল ইতিহাস",
    ayushOpd: "আয়ুষ OPD",
    ayushOpdDesc: "আয়ুৰ্বেদিক মূল্যায়নৰ বাবে দশবিধ পৰীক্ষা অন্তৰ্ভুক্ত",
    listenBtn: "শুনক",
  },
  ne: {
    title: "OPD प्रकार छान्नुहोस्",
    generalOpd: "सामान्य OPD",
    generalOpdDesc: "मानक एलोप्याथिक क्लिनिकल इतिहास",
    ayushOpd: "आयुष OPD",
    ayushOpdDesc: "आयुर्वेदिक मूल्याङ्कनको लागि दशविध परीक्षा समावेश गर्दछ",
    listenBtn: "सुन्नुहोस्",
  },
  sa: {
    title: "OPD प्रकारं चिनोतु",
    generalOpd: "सामान्य OPD",
    generalOpdDesc: "मानक एलोपैथिक चिकित्सा इतिहासः",
    ayushOpd: "आयुष OPD",
    ayushOpdDesc: "आयुर्वेदिक परीक्षणाय दशविध परीक्षा अन्तर्भवति",
    listenBtn: "शृणोतु",
  }
};

function getLocalText(lang: string, key: string): string {
  return LOCAL_TRANS[lang]?.[key] ?? LOCAL_TRANS["en"][key];
}

export default function OPDSelectPage() {
  const router = useRouter();
  const [lang, setLang] = useState("hi");
  const [mode, setMode] = useState<OPDMode | null>(null);
  
  const { speak, stop, isSpeaking } = usePageSpeaker(lang);

  useEffect(() => {
    const l = sessionStorage.getItem("mk_lang") || "hi";
    setLang(l);
    
    // Auto-select if we already have it
    const existingMode = sessionStorage.getItem("mk_mode");
    if (existingMode === "allopathic" || existingMode === "ayush") {
      setMode(existingMode as OPDMode);
    }
  }, []);

  const handleNext = () => {
    if (mode) {
      sessionStorage.setItem("mk_mode", mode);
      router.push("/history");
    }
  };

  const handleBack = () => {
    router.push("/consent");
  };

  const playAudioInstruction = () => {
    const introText = getLocalText(lang, "title");
    const generalTitle = getLocalText(lang, "generalOpd");
    const generalDesc = getLocalText(lang, "generalOpdDesc");
    const ayushTitle = getLocalText(lang, "ayushOpd");
    const ayushDesc = getLocalText(lang, "ayushOpdDesc");
    
    speak(`${introText}. ${generalTitle}: ${generalDesc}. ${ayushTitle}: ${ayushDesc}`);
  };

  return (
    <KioskScreen>
      <KioskHeader
        title={getLocalText(lang, "title")}
        subtitle={getLocalText("en", "title")}
        progress={25}
        stepLabel="Step 3 of 6"
        onBack={handleBack}
        rightSlot={
          <Button
            variant={isSpeaking ? "primary" : "secondary"}
            size="sm"
            onClick={isSpeaking ? stop : playAudioInstruction}
            className="rounded-full gap-2 px-4"
          >
            <span className="text-xl">{isSpeaking ? "⏹" : "🔊"}</span>
            {getLocalText(lang, "listenBtn")}
          </Button>
        }
      />
      <KioskBody className="flex flex-col gap-6 pt-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid gap-6 sm:grid-cols-2"
        >
          {/* General OPD Card */}
          <Card
            interactive
            selected={mode === "allopathic"}
            onClick={() => setMode("allopathic")}
            className={cn(
              "p-6 sm:p-8 flex flex-col items-center text-center gap-4 border-2 transition-all duration-300",
              mode === "allopathic" ? "border-brand-500 bg-brand-50/50 shadow-md" : "border-neutral-200"
            )}
          >
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-2",
              mode === "allopathic" ? "bg-brand-100 text-brand-600" : "bg-neutral-100"
            )}>
              🏥
            </div>
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">
                {getLocalText(lang, "generalOpd")}
              </h2>
              <p className="text-sm font-semibold text-neutral-500 mb-4">
                {getLocalText("en", "generalOpd")}
              </p>
              <p className="text-neutral-600 font-medium">
                {getLocalText(lang, "generalOpdDesc")}
              </p>
            </div>
          </Card>

          {/* AYUSH OPD Card */}
          <Card
            interactive
            selected={mode === "ayush"}
            onClick={() => setMode("ayush")}
            className={cn(
              "p-6 sm:p-8 flex flex-col items-center text-center gap-4 border-2 transition-all duration-300",
              mode === "ayush" ? "border-brand-500 bg-brand-50/50 shadow-md" : "border-neutral-200"
            )}
          >
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-2",
              mode === "ayush" ? "bg-brand-100 text-brand-600" : "bg-neutral-100"
            )}>
              🌿
            </div>
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">
                {getLocalText(lang, "ayushOpd")}
              </h2>
              <p className="text-sm font-semibold text-neutral-500 mb-4">
                {getLocalText("en", "ayushOpd")}
              </p>
              <p className="text-neutral-600 font-medium">
                {getLocalText(lang, "ayushOpdDesc")}
              </p>
            </div>
          </Card>
        </motion.div>
      </KioskBody>
      
      <KioskFooter>
        <div className="flex gap-4">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={handleBack}
          >
            {t(lang, "back")}
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={!mode}
            onClick={handleNext}
          >
            {t(lang, "next")}
          </Button>
        </div>
      </KioskFooter>
    </KioskScreen>
  );
}
