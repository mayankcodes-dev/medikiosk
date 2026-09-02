"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/translations";
import { motion } from "framer-motion";
import {
  KioskHeader,
  KioskScreen,
  KioskBody,
  KioskFooter,
} from "@/components/kiosk/KioskLayout";
import { Button, Card, Badge } from "@/components/ui/primitives";
import type { StructuredSummary } from "@/app/api/history/chat/route";
import { cn } from "@/lib/utils";

type SummaryStatus = "generating" | "ready";

// ── Fallback if no real summary in sessionStorage ────────────────
const MOCK_SUMMARY: StructuredSummary = {
  chiefComplaint: "Fever with headache",
  duration: "3 days",
  severity: "moderate",
  character: "Continuous, throbbing headache",
  associatedSymptoms: ["Nausea", "Mild cough"],
  pastHistory: "Type 2 Diabetes, Hypertension",
  currentMedications: "Metformin 500mg, Amlodipine 5mg",
  suggestedICD10: "R50.9 — Fever, unspecified",
  redFlags: ["Low platelet — consider dengue workup", "Elevated RBS — review Metformin dose"],
  ayushNote: "Pitta-dominant presentation. Possible Vishama Jwara. Recommend Dashavidha Pariksha.",
};

const SEV_COLORS: Record<string, string> = {
  mild: "bg-green-50 text-green-700 border-green-200",
  moderate: "bg-secondary-50 text-secondary-700 border-secondary-200",
  severe: "bg-red-50 text-red-700 border-red-200",
  "very severe": "bg-red-100 text-red-800 border-red-300",
};

export default function SummaryPage() {
  const router = useRouter();
  const [lang, setLang] = useState("hi");
  const [status, setStatus] = useState<SummaryStatus>("generating");
  const [submitted, setSubmitted] = useState(false);
  const [summary, setSummary] = useState<StructuredSummary>(MOCK_SUMMARY);
  const [tokenNumber] = useState(`A-${String(Math.floor(Math.random() * 99) + 1).padStart(3, "0")}`);

  useEffect(() => {
    setLang(sessionStorage.getItem("mk_lang") ?? "hi");

    // Load real AI summary from history page if available
    const saved = sessionStorage.getItem("mk_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.summary) {
          setSummary(parsed.summary);
        }
      } catch { /* use fallback */ }
    }

    const timer = setTimeout(() => setStatus("ready"), 2000);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit() {
    setSubmitted(true);
    sessionStorage.setItem("mk_summary_submitted", "true");
    await new Promise((r) => setTimeout(r, 1000));
    router.push("/complete");
  }

  // ── Generating screen ─────────────────────────────────────────
  if (status === "generating") {
    return (
      <KioskScreen>
        <KioskBody className="flex flex-col items-center justify-center gap-6 py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="h-14 w-14 rounded-full border-4 border-brand-100 border-t-brand-600"
          />
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-neutral-900">
              {t(lang, "summaryReady")}...
            </h2>
            <p className="text-sm text-neutral-400">
              AI is structuring your medical history
            </p>
          </div>
          <div className="text-left w-full max-w-xs space-y-2">
            {["Organising symptoms...", "Mapping ICD-10 codes...", "Checking red flags...", "Generating AYUSH note..."].map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.4 }}
                className="flex items-center gap-2 text-sm text-neutral-500"
              >
                <span className="text-brand-500">✓</span> {step}
              </motion.div>
            ))}
          </div>
        </KioskBody>
      </KioskScreen>
    );
  }

  // ── Ready screen ──────────────────────────────────────────────
  const sevColor = SEV_COLORS[summary.severity?.toLowerCase()] ?? SEV_COLORS.moderate;

  return (
    <KioskScreen>
      <KioskHeader
        title={t(lang, "summaryReady")}
        subtitle="AI Clinical Summary Ready"
        onBack={() => router.push("/scan")}
        progress={90}
        stepLabel="6 / 6"
      />

      <KioskBody className="space-y-3">
        {/* Token number */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center justify-between bg-brand-600 text-white
                     rounded-2xl px-5 py-4"
        >
          <div>
            <p className="text-sm font-medium opacity-80">{t(lang, "yourToken")}</p>
            <p className="text-4xl font-black tracking-wide">{tokenNumber}</p>
            <p className="text-xs opacity-70 mt-1">Your Token Number</p>
          </div>
          <div className="text-5xl">🎫</div>
        </motion.div>

        {/* Chief complaint + severity */}
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wide mb-1">
                Chief Complaint
              </p>
              <p className="font-bold text-neutral-900 text-base leading-snug">
                {summary.chiefComplaint}
              </p>
              <p className="text-sm text-neutral-500 mt-1">
                Duration: <span className="font-semibold">{summary.duration}</span>
              </p>
            </div>
            <span className={cn(
              "text-xs font-bold px-3 py-1.5 rounded-full border shrink-0",
              sevColor
            )}>
              {summary.severity}
            </span>
          </div>
          {summary.character && (
            <p className="text-sm text-neutral-600 mt-2 pt-2 border-t border-neutral-100">
              <span className="font-semibold">Character: </span>{summary.character}
            </p>
          )}
        </Card>

        {/* Associated symptoms */}
        {summary.associatedSymptoms?.length > 0 && (
          <Card className="p-4">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
              Associated Symptoms
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.associatedSymptoms.map((s) => (
                <span key={s} className="bg-neutral-100 text-neutral-700 text-sm
                                         px-3 py-1 rounded-full font-medium">
                  {s}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Past history + medications */}
        <div className="grid grid-cols-2 gap-2.5">
          <Card className="p-3">
            <p className="text-xs font-semibold text-neutral-400 uppercase mb-1.5">Past History</p>
            <p className="text-sm text-neutral-700">{summary.pastHistory || "None reported"}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs font-semibold text-neutral-400 uppercase mb-1.5">Medications</p>
            <p className="text-sm text-neutral-700">{summary.currentMedications || "None"}</p>
          </Card>
        </div>

        {/* ICD-10 */}
        <Card className="p-4 flex items-center gap-3">
          <span className="text-2xl">🏷️</span>
          <div>
            <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wide">Suggested ICD-10</p>
            <p className="font-bold text-neutral-900 text-sm">{summary.suggestedICD10}</p>
          </div>
        </Card>

        {/* Red flags */}
        {summary.redFlags?.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2"
          >
            <p className="text-sm font-bold text-red-800 flex items-center gap-2">
              🚨 Red Flags — Doctor Attention Required
            </p>
            {summary.redFlags.map((flag) => (
              <p key={flag} className="text-sm text-red-700 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span> {flag}
              </p>
            ))}
          </motion.div>
        )}

        {/* AYUSH note */}
        {summary.ayushNote && (
          <Card className="p-4 bg-green-50 border-green-200">
            <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">
              🌿 AYUSH Clinical Note
            </p>
            <p className="text-sm text-green-900">{summary.ayushNote}</p>
          </Card>
        )}
      </KioskBody>

      <KioskFooter>
        <Button
          variant="primary"
          size="xl"
          fullWidth
          loading={submitted}
          onClick={handleSubmit}
        >
          {submitted ? "Submitting..." : `✅ ${t(lang, "submitToDoctor")}`}
        </Button>
      </KioskFooter>
    </KioskScreen>
  );
}
