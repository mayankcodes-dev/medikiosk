"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { KioskHeader, KioskScreen, KioskBody, KioskFooter } from "@/components/kiosk/KioskLayout";
import { Button, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface ConsentItem {
  id: string;
  icon: string;
  title: string;
  titleEn: string;
  description: string;
  required: boolean;
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: "dataCapture",
    icon: "🎙️",
    title: "बीमारी का इतिहास बताना",
    titleEn: "Share my medical history for this visit",
    description: "Your voice/touch responses will be processed by AI to create a clinical summary for your doctor.",
    required: true,
  },
  {
    id: "doctorShare",
    icon: "👨‍⚕️",
    title: "डॉक्टर के साथ साझा करना",
    titleEn: "Share summary with my doctor today",
    description: "The structured history summary will appear on the doctor's screen before consultation.",
    required: true,
  },
  {
    id: "abhaLink",
    icon: "🔗",
    title: "ABHA रिकॉर्ड में सेव करना",
    titleEn: "Save to my ABHA health record",
    description: "Your history will be saved to your permanent Ayushman Bharat health account.",
    required: false,
  },
  {
    id: "audioRecording",
    icon: "🔊",
    title: "आवाज़ रिकॉर्डिंग",
    titleEn: "Allow voice recording",
    description: "Audio is processed locally and deleted after your session. Never stored permanently.",
    required: false,
  },
];

export default function ConsentPage() {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({
    dataCapture: false,
    doctorShare: false,
    abhaLink: false,
    audioRecording: false,
  });
  const [audioPlaying, setAudioPlaying] = useState(false);

  const requiredChecked = CONSENT_ITEMS.filter((i) => i.required).every(
    (i) => checked[i.id]
  );

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleProceed() {
    sessionStorage.setItem("mk_consent", JSON.stringify(checked));
    router.push("/history");
  }

  // Mock TTS audio guidance
  function handlePlayAudio() {
    setAudioPlaying(true);
    setTimeout(() => setAudioPlaying(false), 4000);
  }

  return (
    <KioskScreen>
      <KioskHeader
        title="आपकी सहमति"
        subtitle="Your Consent — Step 2 of 6"
        onBack={() => router.push("/login")}
        progress={20}
        stepLabel="Step 2 of 6"
        rightSlot={
          <button
            onClick={handlePlayAudio}
            aria-label="Play audio explanation"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all",
              audioPlaying
                ? "bg-brand-600 text-white"
                : "bg-brand-50 text-brand-700 hover:bg-brand-100"
            )}
          >
            {audioPlaying ? (
              <span className="animate-pulse">🔊 Playing...</span>
            ) : (
              <>🔊 सुनें</>
            )}
          </button>
        }
      />

      <KioskBody className="space-y-4">
        {/* Intro card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-brand-50 rounded-2xl border border-brand-100 p-4 mb-2">
            <div className="flex gap-3 items-start">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="font-semibold text-brand-900 text-sm">
                  आपकी गोपनीयता हमारी जिम्मेदारी है
                </p>
                <p className="text-xs text-brand-700 mt-1">
                  Your data is protected under{" "}
                  <strong>DPDP Act 2023</strong> &amp; ABDM consent framework.
                  Session data is deleted after you leave.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Consent items */}
        {CONSENT_ITEMS.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card
              interactive
              selected={checked[item.id]}
              className="p-4"
              onClick={() => toggle(item.id)}
              role="checkbox"
              aria-checked={checked[item.id]}
              tabIndex={0}
              onKeyDown={(e) => e.key === " " && toggle(item.id)}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <div
                  className={cn(
                    "shrink-0 mt-0.5 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all",
                    checked[item.id]
                      ? "bg-brand-600 border-brand-600"
                      : "border-neutral-300 bg-white"
                  )}
                >
                  {checked[item.id] && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2.5 7L5.5 10L11.5 4"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>

                <span className="text-2xl shrink-0">{item.icon}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-neutral-900 text-base leading-tight">
                      {item.title}
                    </p>
                    {item.required ? (
                      <span className="text-xs bg-error-50 text-error-600 px-2 py-0.5 rounded-full font-semibold">
                        ज़रूरी / Required
                      </span>
                    ) : (
                      <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
                    {item.titleEn}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}

        <p className="text-xs text-neutral-400 text-center pt-2">
          आप किसी भी समय अपनी सहमति वापस ले सकते हैं।
          <br />
          You can withdraw consent at any time.
        </p>
      </KioskBody>

      <KioskFooter>
        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={!requiredChecked}
          onClick={handleProceed}
          icon={<span>→</span>}
          iconPosition="right"
        >
          ✅ &nbsp;सहमत हूं — आगे बढ़ें &nbsp;/ &nbsp;I Agree — Continue
        </Button>
        {!requiredChecked && (
          <p className="text-center text-sm text-neutral-400 mt-2">
            ऊपर ज़रूरी विकल्प चुनें / Please check the required items above
          </p>
        )}
      </KioskFooter>
    </KioskScreen>
  );
}
