// src/app/summary/page.tsx
// Clinical summary review — shows AI-generated summary from voice history
// AND merges extracted document data (lab values, medications from scans).
// Patient reviews everything before submitting to doctor queue.

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
import { Button, Card } from "@/components/ui/primitives";
import type { StructuredSummary } from "@/app/api/history/chat/route";
import type { ExtractedDoc } from "@/app/api/scan/extract/route";
import { cn } from "@/lib/utils";

type SummaryStatus = "generating" | "ready";

// ── Placeholder if no real summary (e.g. skip straight to /summary) ─
const PLACEHOLDER_SUMMARY: StructuredSummary = {
  chiefComplaint: "History not recorded — please proceed to doctor",
  duration: "—",
  severity: "moderate",
  character: "—",
  associatedSymptoms: [],
  pastHistory: "—",
  currentMedications: "—",
  suggestedICD10: "",
  redFlags: [],
  ayushNote: "",
};

const SEV_COLORS: Record<string, string> = {
  mild: "bg-green-50 text-green-700 border-green-200",
  moderate: "bg-secondary-50 text-secondary-700 border-secondary-200",
  severe: "bg-red-50 text-red-700 border-red-200",
  "very severe": "bg-red-100 text-red-800 border-red-300",
};

const FLAG_COLOR: Record<string, string> = {
  H: "text-red-600 font-bold",
  L: "text-blue-600 font-bold",
  N: "text-green-700",
  "": "text-neutral-600",
};

export default function SummaryPage() {
  const router = useRouter();
  const [lang, setLang] = useState("hi");
  const [status, setStatus] = useState<SummaryStatus>("generating");
  const [submitted, setSubmitted] = useState(false);
  const [summary, setSummary] = useState<StructuredSummary>(PLACEHOLDER_SUMMARY);
  const [docs, setDocs] = useState<ExtractedDoc[]>([]);
  const [isMockSummary, setIsMockSummary] = useState(false);

  useEffect(() => {
    setLang(sessionStorage.getItem("mk_lang") ?? "hi");

    // ── Load voice history summary ───────────────────────────────
    const saved = sessionStorage.getItem("mk_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.summary && parsed.summary.chiefComplaint) {
          setSummary(parsed.summary);
          setIsMockSummary(false);
        } else {
          setIsMockSummary(true);
        }
      } catch {
        setIsMockSummary(true);
      }
    } else {
      setIsMockSummary(true);
    }

    // ── Load extracted document data ─────────────────────────────
    const docsRaw = sessionStorage.getItem("mk_docs");
    if (docsRaw) {
      try {
        const parsedDocs: ExtractedDoc[] = JSON.parse(docsRaw);
        setDocs(Array.isArray(parsedDocs) ? parsedDocs : []);
      } catch { /* ignore parse errors */ }
    }

    const timer = setTimeout(() => setStatus("ready"), 1800);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit() {
    setSubmitted(true);
    sessionStorage.setItem("mk_summary_submitted", "true");
    await new Promise((r) => setTimeout(r, 600));
    router.push("/complete");
  }

  // ── Generating screen ───────────────────────────────────────────
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
            {[
              "Organising symptoms...",
              "Mapping ICD-10 codes...",
              "Checking red flags...",
              "Merging document data...",
              "Generating AYUSH note...",
            ].map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.32 }}
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

  // ── Ready screen — derived data ─────────────────────────────────
  const sevColor = SEV_COLORS[summary.severity?.toLowerCase()] ?? SEV_COLORS.moderate;

  const abnormalLabs = docs.flatMap((doc) =>
    doc.labValues?.filter((lv) => lv.flag === "H" || lv.flag === "L") ?? []
  );
  const docMedNames = new Set(
    docs.flatMap((doc) => doc.medications?.map((m) => m.name) ?? [])
  );

  function handlePrint() {
    const docsSection =
      docs.length > 0
        ? `\n\nEXTRACTED FROM ${docs.length} DOCUMENT(S):\n` +
          (abnormalLabs.length > 0
            ? `Abnormal Labs:\n${abnormalLabs
                .map((lv) => `  ${lv.test}: ${lv.value} ${lv.unit} [${lv.flag}]`)
                .join("\n")}\n`
            : "") +
          (docMedNames.size > 0
            ? `Medications (Docs):\n${Array.from(docMedNames)
                .map((m) => `  ${m}`)
                .join("\n")}`
            : "")
        : "";

    const content = [
      "MediKiosk — Patient Clinical Summary",
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      `Language: ${lang.toUpperCase()}`,
      "",
      `Chief Complaint: ${summary.chiefComplaint}`,
      `Duration: ${summary.duration}`,
      `Severity: ${summary.severity}`,
      summary.character ? `Character: ${summary.character}` : "",
      (summary.associatedSymptoms?.length ?? 0) > 0
        ? `Associated: ${summary.associatedSymptoms.join(", ")}`
        : "",
      `Past History: ${summary.pastHistory || "None"}`,
      `Medications (Reported): ${summary.currentMedications || "None"}`,
      summary.suggestedICD10 ? `ICD-10 (AI): ${summary.suggestedICD10}` : "",
      (summary.redFlags?.length ?? 0) > 0
        ? `RED FLAGS:\n${summary.redFlags.map((f) => `  ⚠ ${f}`).join("\n")}`
        : "",
      summary.ayushNote ? `AYUSH Note: ${summary.ayushNote}` : "",
      docsSection,
      "",
      "Generated by MediKiosk AI · ABDM Compliant",
    ]
      .filter(Boolean)
      .join("\n");

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(
        `<pre style="font-family:monospace;font-size:13px;padding:24px;white-space:pre-wrap">${content}</pre>`
      );
      win.print();
      win.close();
    }
  }

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
        {/* Warning banner if no real history was taken */}
        {isMockSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3"
          >
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-800">
                Voice history not completed
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Please complete the voice/touch interview for a full AI summary.
                Document data below is still available to the doctor.
              </p>
            </div>
          </motion.div>
        )}

        {/* Chief complaint + severity */}
        {!isMockSummary && (
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
              <span
                className={cn(
                  "text-xs font-bold px-3 py-1.5 rounded-full border shrink-0",
                  sevColor
                )}
              >
                {summary.severity}
              </span>
            </div>
            {summary.character && summary.character !== "—" && (
              <p className="text-sm text-neutral-600 mt-2 pt-2 border-t border-neutral-100">
                <span className="font-semibold">Character: </span>
                {summary.character}
              </p>
            )}
          </Card>
        )}

        {/* Associated symptoms */}
        {(summary.associatedSymptoms?.length ?? 0) > 0 && (
          <Card className="p-4">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
              Associated Symptoms
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.associatedSymptoms.map((s) => (
                <span
                  key={s}
                  className="bg-neutral-100 text-neutral-700 text-sm px-3 py-1 rounded-full font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Past history + medications (from voice history) */}
        {!isMockSummary && (
          <div className="grid grid-cols-2 gap-2.5">
            <Card className="p-3">
              <p className="text-xs font-semibold text-neutral-400 uppercase mb-1.5">
                Past History
              </p>
              <p className="text-sm text-neutral-700">
                {summary.pastHistory || "None reported"}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs font-semibold text-neutral-400 uppercase mb-1.5">
                Medications (Reported)
              </p>
              <p className="text-sm text-neutral-700">
                {summary.currentMedications || "None"}
              </p>
            </Card>
          </div>
        )}

        {/* ── Document-extracted data panel ─────────────────────── */}
        {docs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2.5"
          >
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1">
              📄 Extracted from {docs.length} uploaded document
              {docs.length > 1 ? "s" : ""}
            </p>

            {/* Abnormal lab values */}
            {abnormalLabs.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                  Abnormal Lab Values
                </p>
                <div className="space-y-1.5">
                  {abnormalLabs.map((lv, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-neutral-700">{lv.test}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn("font-mono", FLAG_COLOR[lv.flag])}
                        >
                          {lv.value} {lv.unit}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded font-bold",
                            lv.flag === "H"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          )}
                        >
                          {lv.flag}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Medications from prescriptions */}
            {docMedNames.size > 0 && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                  Medications (from Documents)
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(docMedNames).map((med) => (
                    <span
                      key={med}
                      className="bg-brand-50 text-brand-700 text-xs px-2.5 py-1 rounded-full font-medium border border-brand-100"
                    >
                      💊 {med}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Diagnoses from discharge summaries */}
            {docs.some((d) => (d.diagnoses?.length ?? 0) > 0) && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                  Previous Diagnoses (from Documents)
                </p>
                <div className="space-y-1">
                  {docs
                    .flatMap((d) => d.diagnoses ?? [])
                    .map((dx, i) => (
                      <p
                        key={i}
                        className="text-sm text-neutral-700 flex items-start gap-2"
                      >
                        <span className="text-neutral-400 shrink-0">•</span>{" "}
                        {dx}
                      </p>
                    ))}
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {/* ICD-10 */}
        {summary.suggestedICD10 && (
          <Card className="p-4 flex items-center gap-3">
            <span className="text-2xl">🏷️</span>
            <div>
              <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wide">
                Suggested ICD-10
              </p>
              <p className="font-bold text-neutral-900 text-sm">
                {summary.suggestedICD10}
              </p>
            </div>
          </Card>
        )}

        {/* Red flags */}
        {(summary.redFlags?.length ?? 0) > 0 && (
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
              <p
                key={flag}
                className="text-sm text-red-700 flex items-start gap-2"
              >
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

        {/* Print button */}
        <button
          onClick={handlePrint}
          className="w-full border border-neutral-200 text-neutral-500 text-sm font-semibold
                     py-2.5 rounded-2xl hover:bg-neutral-50 transition-colors flex items-center
                     justify-center gap-2"
        >
          🖨️ Print Summary
        </button>

        {/* Privacy notice */}
        <p className="text-xs text-neutral-400 text-center pt-1 pb-2">
          🔒 This summary is encrypted and will only be shared with your doctor today.
        </p>
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
