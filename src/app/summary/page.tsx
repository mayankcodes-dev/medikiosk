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
import { Button, Card, Badge, Spinner } from "@/components/ui/primitives";

// ── Mock summary generation for Phase 0 ─────────────────────────
const MOCK_SUMMARY = {
  patient: { name: "Ramesh Kumar", abha: "91-1234-5678-9012", age: "48M" },
  chiefComplaint: "Fever with headache × 3 days",
  hpi: "Patient c/o high-grade fever (38.5°C) with severe bifrontal headache since 3 days. Fever is continuous. Associated with mild nausea. No vomiting, no rash, no cold/cough.",
  pastHistory: "Known case of Type 2 Diabetes Mellitus (T2DM) and Hypertension",
  drugHistory: "Metformin 500mg BD, Amlodipine 5mg OD (from OCR'd prescription)",
  allergies: "NKDA (No Known Drug Allergy)",
  familyHistory: "Not reported",
  personalHistory: "Non-smoker, non-alcoholic",
  ros: "CVS: No chest pain. RS: No breathlessness. GIT: Mild nausea. CNS: Headache present.",
  investigations: [
    { test: "RBS", value: "182 mg/dL", ref: "70-140", flag: "HIGH ⚠️" },
    { test: "Hb", value: "11.2 g/dL", ref: "13-17", flag: "LOW ⚠️" },
    { test: "Platelet", value: "1.2 L/cumm", ref: "1.5-4.0", flag: "LOW ⚠️" },
  ],
  alerts: [
    "⚠️ Low platelet count — consider dengue workup",
    "⚠️ Random blood sugar elevated — adjust Metformin?",
    "⚠️ Mild anaemia noted",
  ],
  tokenNumber: "A-042",
};

type SummaryStatus = "generating" | "ready";

export default function SummaryPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SummaryStatus>("generating");
  const [submitted, setSubmitted] = useState(false);

  // Simulate summary generation
  useEffect(() => {
    const t = setTimeout(() => setStatus("ready"), 2500);
    return () => clearTimeout(t);
  }, []);

  async function handleConfirmAndSubmit() {
    setSubmitted(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.push("/complete");
  }

  if (status === "generating") {
    return (
      <KioskScreen centered>
        <div className="flex flex-col items-center gap-6 px-8 text-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-brand-50 flex items-center justify-center text-5xl">
              🧠
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1">
              <Spinner className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">
              AI सारांश बना रहा है
            </h2>
            <p className="text-neutral-500 mt-1">
              Generating your clinical summary...
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-neutral-400 w-full max-w-xs">
            {[
              "✅ Voice history processed",
              "✅ Documents analysed",
              "⏳ Generating physician summary...",
            ].map((step, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.6 }}
              >
                {step}
              </motion.p>
            ))}
          </div>
        </div>
      </KioskScreen>
    );
  }

  return (
    <KioskScreen>
      <KioskHeader
        title="आपका सारांश तैयार है"
        subtitle="Clinical Summary — Step 6 of 6"
        onBack={() => router.push("/scan")}
        progress={100}
        stepLabel="Step 6 of 6"
      />

      <KioskBody className="space-y-4">
        {/* Patient token */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-600 text-white rounded-2xl p-5 flex items-center justify-between"
        >
          <div>
            <p className="text-sm text-brand-200">Your Token Number</p>
            <p className="text-4xl font-extrabold tracking-wider">
              {MOCK_SUMMARY.tokenNumber}
            </p>
            <p className="text-sm text-brand-200 mt-1">
              {MOCK_SUMMARY.patient.name} · {MOCK_SUMMARY.patient.age}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-brand-200">ABHA linked</p>
            <p className="text-sm font-mono text-brand-100">
              {MOCK_SUMMARY.patient.abha.slice(-8)}
            </p>
            <Badge variant="success" className="mt-2 bg-white/20 text-white">
              ✅ Summary Ready
            </Badge>
          </div>
        </motion.div>

        {/* Alerts */}
        {MOCK_SUMMARY.alerts.length > 0 && (
          <Card className="p-4 border-warning-200 bg-warning-50">
            <p className="font-bold text-warning-700 text-sm mb-2">
              🚨 Doctor Alerts (AI Flagged)
            </p>
            <ul className="space-y-1">
              {MOCK_SUMMARY.alerts.map((a, i) => (
                <li key={i} className="text-sm text-warning-700">{a}</li>
              ))}
            </ul>
          </Card>
        )}

        {/* Summary sections */}
        {[
          { label: "🩺 Chief Complaint", value: MOCK_SUMMARY.chiefComplaint },
          { label: "📋 History of Present Illness", value: MOCK_SUMMARY.hpi },
          { label: "🏥 Past Medical History", value: MOCK_SUMMARY.pastHistory },
          { label: "💊 Drug History", value: MOCK_SUMMARY.drugHistory },
          { label: "⚠️ Allergies", value: MOCK_SUMMARY.allergies },
          { label: "🔬 Review of Systems", value: MOCK_SUMMARY.ros },
        ].map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="p-4">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                {section.label}
              </p>
              <p className="text-sm text-neutral-800 leading-relaxed">
                {section.value}
              </p>
            </Card>
          </motion.div>
        ))}

        {/* Investigations */}
        <Card className="p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
            🧪 Prior Investigations (from documents)
          </p>
          <div className="space-y-2">
            {MOCK_SUMMARY.investigations.map((inv, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-neutral-700">{inv.test}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-900 text-sm">{inv.value}</span>
                  <span className="text-xs text-neutral-400">({inv.ref})</span>
                  {inv.flag && (
                    <Badge variant="warning" className="text-xs px-2 py-0.5">
                      {inv.flag}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Draft disclaimer */}
        <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500 text-center">
            📝 This is an AI-generated <strong>draft</strong> for physician review.
            Your doctor will verify and edit before finalising.
          </p>
        </div>
      </KioskBody>

      <KioskFooter>
        <Button
          variant="primary"
          size="xl"
          fullWidth
          loading={submitted}
          onClick={handleConfirmAndSubmit}
        >
          ✅ &nbsp;डॉक्टर को भेजें / Submit to Doctor
        </Button>
      </KioskFooter>
    </KioskScreen>
  );
}
