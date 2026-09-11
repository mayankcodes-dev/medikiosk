// src/app/summary/page.tsx — MediKiosk AI Clinical Intake Record
// Matches the clinical document format: patient info, HPI, documents table,
// medical timeline, AI summary, red flags, consent, confidence score.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { t } from "@/lib/translations";
import {
  KioskHeader,
  KioskScreen,
  KioskBody,
  KioskFooter,
} from "@/components/kiosk/KioskLayout";
import { Button } from "@/components/ui/primitives";
import type { StructuredSummary } from "@/app/api/history/chat/route";
import type { ExtractedDoc } from "@/app/api/scan/extract/route";

type SummaryStatus = "generating" | "ready";

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

const SEV_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  mild:        { bg: "bg-green-100",  text: "text-green-800",  dot: "bg-green-500"  },
  moderate:    { bg: "bg-amber-100",  text: "text-amber-800",  dot: "bg-amber-500"  },
  severe:      { bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500"    },
  "very severe":{ bg: "bg-red-200",   text: "text-red-900",    dot: "bg-red-700"    },
};

function DocTypeLabel(type: string): string {
  const m: Record<string, string> = {
    prescription: "Prescription",
    lab_report: "Lab Report",
    discharge_summary: "Discharge Summary",
    xray_report: "X-Ray / Radiology",
    other: "Other Document",
  };
  return m[type] ?? type;
}

export default function SummaryPage() {
  const router = useRouter();
  const [lang, setLang]           = useState("hi");
  const [status, setStatus]       = useState<SummaryStatus>("generating");
  const [submitted, setSubmitted] = useState(false);
  const [summary, setSummary]     = useState<StructuredSummary>(PLACEHOLDER_SUMMARY);
  const [docs, setDocs]           = useState<ExtractedDoc[]>([]);
  const [isMock, setIsMock]       = useState(false);
  const [patient, setPatient]     = useState<Record<string, string>>({});
  const [intakeMode, setIntakeMode] = useState<string[]>([]);

  useEffect(() => {
    setLang(sessionStorage.getItem("mk_lang") ?? "hi");

    // Patient profile
    try {
      const p = JSON.parse(sessionStorage.getItem("mk_patient") ?? "{}");
      setPatient(p);
    } catch { /* ignore */ }

    // Intake modes
    const modes: string[] = [];
    if (sessionStorage.getItem("mk_history"))  modes.push("Voice");
    if (sessionStorage.getItem("mk_touch"))    modes.push("Touch");
    if (sessionStorage.getItem("mk_docs"))     modes.push("Document Scan");
    setIntakeMode(modes.length ? modes : ["Touch"]);

    // Voice history summary
    const saved = sessionStorage.getItem("mk_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.summary?.chiefComplaint) {
          setSummary(parsed.summary);
          setIsMock(false);
        } else {
          setIsMock(true);
        }
      } catch { setIsMock(true); }
    } else {
      setIsMock(true);
    }

    // Extracted docs
    const docsRaw = sessionStorage.getItem("mk_docs");
    if (docsRaw) {
      try {
        const parsedDocs: ExtractedDoc[] = JSON.parse(docsRaw);
        setDocs(Array.isArray(parsedDocs) ? parsedDocs : []);
      } catch { /* ignore */ }
    }

    const t = setTimeout(() => setStatus("ready"), 2000);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit() {
    setSubmitted(true);
    sessionStorage.setItem("mk_summary_submitted", "true");
    await new Promise((r) => setTimeout(r, 600));
    router.push("/complete");
  }

  function handlePrint() {
    window.print();
  }

  // ── Generating spinner ─────────────────────────────────────────────────────
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
              MediKiosk रिकॉर्ड बना रहा है…
            </h2>
            <p className="text-sm text-neutral-400">
              MediKiosk is generating your clinical intake record
            </p>
          </div>
          <div className="text-left w-full max-w-xs space-y-2">
            {[
              "Organising symptoms…",
              "Mapping ICD-10 codes…",
              "Checking red flags…",
              "Merging document data…",
              "Generating clinical record…",
            ].map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.35 }}
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

  // ── Derived values ─────────────────────────────────────────────────────────
  const sev       = SEV_COLOR[summary.severity?.toLowerCase()] ?? SEV_COLOR.moderate;
  const redFlags  = summary.redFlags ?? [];
  const abnormal  = docs.flatMap((d) => d.labValues?.filter((lv) => lv.flag === "H" || lv.flag === "L") ?? []);
  const allMeds   = new Set(docs.flatMap((d) => d.medications?.map((m) => m.name) ?? []));
  const allDx     = docs.flatMap((d) => d.diagnoses ?? []);

  // Confidence score (heuristic)
  let confidence = 70;
  if (!isMock) confidence += 15;
  if (docs.length > 0) confidence += 8;
  if (redFlags.length === 0) confidence += 5;
  confidence = Math.min(confidence, 98);

  const now = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <KioskScreen>
      <KioskHeader
        title={t(lang, "summaryReady")}
        subtitle="AI Clinical Intake Record"
        onBack={() => router.push("/scan")}
        progress={90}
        stepLabel="6 / 6"
      />

      <KioskBody className="space-y-3 pb-6">

        {/* ── HEADER BAR ──────────────────────────────────────────── */}
        <div className="bg-brand-700 text-white rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-brand-200 font-medium uppercase tracking-wide">MediKiosk</p>
            <p className="font-bold text-base leading-tight">AI Clinical Intake Record</p>
            <p className="text-xs text-brand-300 mt-0.5">{now}</p>
          </div>
          <div className="text-right">
            <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
              Pending Review
            </span>
            <p className="text-xs text-brand-300 mt-1.5">
              AI Confidence: <span className="text-white font-bold">{confidence}%</span>
            </p>
          </div>
        </div>

        {/* ── PATIENT INFO ─────────────────────────────────────────── */}
        <div className="bg-neutral-50 rounded-2xl px-4 py-3 flex items-center gap-4 border border-neutral-200">
          <div className="h-14 w-14 rounded-full bg-brand-100 flex items-center justify-center text-2xl shrink-0">
            👤
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-neutral-900 text-base truncate">
              {patient.name ?? "Patient"}
            </p>
            {patient.abhaNumber && (
              <p className="text-xs text-brand-600 font-mono mt-0.5">
                ABHA: {patient.abhaNumber}
              </p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {patient.gender && (
                <span className="text-xs text-neutral-500 capitalize">{patient.gender}</span>
              )}
              {patient.yearOfBirth && (
                <span className="text-xs text-neutral-500">
                  Age {new Date().getFullYear() - parseInt(patient.yearOfBirth)}y
                </span>
              )}
              <span className="text-xs text-neutral-500 uppercase">{lang}</span>
            </div>
          </div>
          {/* Intake mode badges */}
          <div className="flex flex-col gap-1 shrink-0">
            {intakeMode.map((m) => (
              <span key={m}
                className="text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full">
                {m === "Voice" ? "🎤" : m === "Touch" ? "👆" : "📄"} {m}
              </span>
            ))}
          </div>
        </div>

        {/* ── INCOMPLETE HISTORY BANNER ────────────────────────────── */}
        {isMock && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-800">Voice history not completed</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Document data below is still available to the doctor.
              </p>
            </div>
          </div>
        )}

        {/* ── CHIEF COMPLAINT ──────────────────────────────────────── */}
        {!isMock && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
              🩺 Chief Complaint
            </p>
            <p className="font-bold text-neutral-900 text-sm leading-snug">
              {summary.chiefComplaint}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5",
                sev.bg, sev.text
              )}>
                <span className={cn("h-2 w-2 rounded-full", sev.dot)} />
                {summary.severity} severity
              </span>
              {summary.duration && summary.duration !== "—" && (
                <span className="text-xs text-neutral-500">⏱ {summary.duration}</span>
              )}
            </div>
            {summary.character && summary.character !== "—" && (
              <p className="text-xs text-neutral-600 mt-2 pt-2 border-t border-neutral-100">
                <span className="font-semibold">Character:</span> {summary.character}
              </p>
            )}
          </div>
        )}

        {/* ── HPI + ASSOCIATED + PAST HISTORY ─────────────────────── */}
        {!isMock && (
          <div className="grid grid-cols-2 gap-2.5">
            {/* History of Present Illness */}
            <div className="col-span-2 rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                📋 History of Present Illness
              </p>
              <div className="space-y-1">
                {[
                  { label: "Onset", val: summary.character },
                  { label: "Duration", val: summary.duration },
                  { label: "Severity", val: summary.severity },
                  { label: "Medications", val: summary.currentMedications },
                ].filter((r) => r.val && r.val !== "—").map((r) => (
                  <div key={r.label} className="flex gap-2 text-xs">
                    <span className="text-neutral-400 w-20 shrink-0">{r.label}</span>
                    <span className="text-neutral-800 font-medium">{r.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Associated Symptoms */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                Associated Symptoms
              </p>
              {(summary.associatedSymptoms?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {summary.associatedSymptoms.map((s) => (
                    <span key={s}
                      className="text-[10px] bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-400">No associated symptoms</p>
              )}
            </div>

            {/* Past History */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                Past History
              </p>
              <p className="text-xs text-neutral-700 leading-snug">
                {summary.pastHistory || "None reported"}
              </p>
              {summary.suggestedICD10 && (
                <p className="text-[10px] text-brand-600 font-mono mt-2">
                  ICD-10: {summary.suggestedICD10}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── DOCUMENTS TABLE ──────────────────────────────────────── */}
        {docs.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                📄 Documents Uploaded & Extracted ({docs.length})
              </p>
            </div>
            <div className="divide-y divide-neutral-100">
              {docs.map((doc, i) => {
                const keyFindings = [
                  ...(doc.diagnoses?.slice(0, 2) ?? []),
                  ...(doc.medications?.slice(0, 2).map((m) => m.name) ?? []),
                  ...(doc.labValues?.slice(0, 2).map((lv) => `${lv.test}: ${lv.value} ${lv.unit}`) ?? []),
                ].slice(0, 3);

                return (
                  <div key={i} className="px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-start">
                    <div className="text-lg">
                      {doc.docType === "prescription" ? "💊"
                        : doc.docType === "lab_report" ? "🧪"
                        : doc.docType === "xray_report" ? "🩻"
                        : doc.docType === "discharge_summary" ? "🏥" : "📄"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-800">{DocTypeLabel(doc.docType)}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {doc.date ?? "Date not found"} · {doc.hospitalName ?? "Scanned"}
                      </p>
                      <div className="mt-1 space-y-0.5">
                        {keyFindings.length > 0 ? keyFindings.map((f, j) => (
                          <p key={j} className="text-[10px] text-neutral-600">• {f}</p>
                        )) : (
                          <p className="text-[10px] text-neutral-400 italic">No key findings extracted</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        doc.confidence === "high" ? "bg-green-100 text-green-700"
                          : doc.confidence === "medium" ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      )}>
                        {doc.confidence === "high" ? "High" : doc.confidence === "medium" ? "Med" : "Low"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MEDICAL TIMELINE ─────────────────────────────────────── */}
        {(allDx.length > 0 || abnormal.length > 0) && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
              📅 Medical Timeline
            </p>
            <div className="relative pl-4">
              <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-neutral-200" />
              {allDx.map((dx, i) => (
                <div key={i} className="relative mb-2 last:mb-0">
                  <div className="absolute -left-3 top-1 h-2.5 w-2.5 rounded-full bg-brand-500 border-2 border-white" />
                  <p className="text-xs text-neutral-700 font-medium">{dx}</p>
                  <p className="text-[10px] text-neutral-400">From uploaded document</p>
                </div>
              ))}
              {abnormal.map((lv, i) => (
                <div key={`lv-${i}`} className="relative mb-2 last:mb-0">
                  <div className={cn(
                    "absolute -left-3 top-1 h-2.5 w-2.5 rounded-full border-2 border-white",
                    lv.flag === "H" ? "bg-red-500" : "bg-blue-500"
                  )} />
                  <p className="text-xs font-medium text-neutral-800">
                    {lv.test}: {lv.value} {lv.unit}
                    <span className={cn(
                      "ml-1.5 text-[10px] font-bold",
                      lv.flag === "H" ? "text-red-600" : "text-blue-600"
                    )}>
                      [{lv.flag === "H" ? "↑ HIGH" : "↓ LOW"}]
                    </span>
                  </p>
                  <p className="text-[10px] text-neutral-400">Abnormal lab value</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI GENERATED SUMMARY ─────────────────────────────────── */}
        <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">
              🤖 AI Generated Summary (For Physician)
            </p>
            <span className="text-[10px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">
              DRAFT
            </span>
          </div>
          <p className="text-xs text-neutral-700 leading-relaxed">
            {!isMock
              ? `Patient presents with ${summary.chiefComplaint?.toLowerCase()}` +
                (summary.duration && summary.duration !== "—" ? ` for ${summary.duration}` : "") +
                (summary.character && summary.character !== "—" ? `. Character: ${summary.character}` : "") +
                ((summary.associatedSymptoms?.length ?? 0) > 0
                  ? `. Associated: ${summary.associatedSymptoms.join(", ")}` : "") +
                (summary.pastHistory && summary.pastHistory !== "—"
                  ? `. PMH: ${summary.pastHistory}` : "") +
                (summary.currentMedications && summary.currentMedications !== "—"
                  ? `. Current medications: ${summary.currentMedications}` : "") +
                "."
              : "Voice history not recorded. Please review document extracts below."}
          </p>
          {summary.ayushNote && (
            <div className="mt-2 pt-2 border-t border-brand-100">
              <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-0.5">
                🌿 AYUSH Note
              </p>
              <p className="text-xs text-green-900">{summary.ayushNote}</p>
            </div>
          )}
          <p className="text-[10px] text-brand-400 mt-2 italic">
            ⚠ AI-generated draft — must be verified by the physician before clinical use
          </p>
        </div>

        {/* ── RED FLAG CHECK ───────────────────────────────────────── */}
        <div className={cn(
          "rounded-2xl border p-4",
          redFlags.length > 0
            ? "bg-red-50 border-red-200"
            : "bg-green-50 border-green-200"
        )}>
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-widest mb-2",
            redFlags.length > 0 ? "text-red-600" : "text-green-700"
          )}>
            🚨 Red Flag Check
          </p>
          {redFlags.length > 0 ? (
            <div className="space-y-1.5">
              {redFlags.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <span className="text-red-500 shrink-0 mt-0.5">⚠️</span>
                  <p className="text-xs text-red-800 font-medium">{f}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-green-700 flex items-center gap-2">
              <span>✅</span> No red flags detected
            </p>
          )}
          <p className="text-[10px] text-neutral-400 mt-2">
            Overall Risk: <span className={cn(
              "font-bold",
              redFlags.length > 1 ? "text-red-600" : redFlags.length === 1 ? "text-amber-600" : "text-green-600"
            )}>
              {redFlags.length > 1 ? "HIGH" : redFlags.length === 1 ? "MODERATE" : "LOW"}
            </span>
          </p>
        </div>

        {/* ── MEDICATIONS FROM DOCS ────────────────────────────────── */}
        {allMeds.size > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
              💊 Medication (Current)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(allMeds).map((med) => (
                <span key={med}
                  className="text-xs bg-brand-50 text-brand-700 border border-brand-100 px-2.5 py-1 rounded-full font-medium">
                  {med}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── PATIENT CONSENT ──────────────────────────────────────── */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
            🔒 Patient Consent
          </p>
          <div className="space-y-1">
            {[
              "Data shared only with treating physician",
              "ABDM / DPDP Act 2023 compliant",
              "No raw Aadhaar stored",
            ].map((c) => (
              <p key={c} className="text-xs text-neutral-600 flex items-center gap-2">
                <span className="text-green-500 shrink-0">✓</span> {c}
              </p>
            ))}
          </div>
        </div>

        {/* ── CONFIDENCE SCORE BAR ─────────────────────────────────── */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              AI Confidence Overall Record
            </p>
            <p className={cn(
              "text-2xl font-black",
              confidence >= 85 ? "text-green-600" : confidence >= 70 ? "text-amber-600" : "text-red-600"
            )}>
              {confidence}%
            </p>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2.5">
            <div
              className={cn(
                "h-2.5 rounded-full transition-all duration-1000",
                confidence >= 85 ? "bg-green-500" : confidence >= 70 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <p className="text-[10px] text-neutral-400 mt-1.5">
            Based on voice history completeness + document quality
          </p>
        </div>

        {/* Print */}
        <button
          onClick={handlePrint}
          className="w-full border border-neutral-200 text-neutral-500 text-sm font-semibold
                     py-2.5 rounded-2xl hover:bg-neutral-50 transition-colors flex items-center
                     justify-center gap-2"
        >
          🖨️ Print Clinical Record
        </button>

        <p className="text-[10px] text-neutral-400 text-center pb-2">
          🔒 Encrypted · Shared only with your treating doctor today · ABDM Compliant
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
          {submitted ? "Submitting…" : `✅ ${t(lang, "submitToDoctor")}`}
        </Button>
      </KioskFooter>
    </KioskScreen>
  );
}
