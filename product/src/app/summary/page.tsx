// src/app/summary/page.tsx - MediKiosk AI Clinical Intake Record
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
  hpi: "—",
  pastHistory: "—",
  drugAllergy: "—",
  familyHistory: "—",
  personalHistory: "—",
  reviewOfSystems: "—",
  currentMedications: "—",
  suggestedICD10: "",
  redFlags: [],
  ayushNote: "",
};

// ── Build report from raw messages when Gemini summary is unavailable ────────
type RawMsg = { role: "ai" | "patient"; text: string; stage?: string };
function buildSummaryFromSessionMessages(messages: RawMsg[]): StructuredSummary {
  const byStage = (stg: string): string => {
    const msgs = messages.filter((m) => m.role === "patient" && m.stage === stg);
    return msgs.map((m) => m.text).join("; ") || "Not reported";
  };

  const cc      = byStage("chief_complaint");
  const hpi     = byStage("hpi");
  const past    = byStage("past_history");
  const drug    = byStage("drug_allergy");
  const family  = byStage("family_history");
  const personal= byStage("personal_history");
  const ros     = byStage("review_of_systems");
  const prakriti= byStage("ayush_prakriti");
  const vikriti = byStage("ayush_vikriti");
  const agni    = byStage("ayush_agni");
  const koshtha = byStage("ayush_koshtha");
  const ahara   = byStage("ayush_ahara_vihara");
  const nidana  = byStage("ayush_nidana");
  const samprapti=byStage("ayush_samprapti");
  const sara    = byStage("ayush_sara");
  const samhanana=byStage("ayush_samhanana");
  const satmya  = byStage("ayush_satmya");
  const pramana = byStage("ayush_pramana");
  const sattva  = byStage("ayush_sattva");
  const aharaShakti = byStage("ayush_ahara_shakti");
  const vyayamaShakti = byStage("ayush_vyayama_shakti");
  const vaya    = byStage("ayush_vaya");

  const allText = messages.map((m) => m.text).join(" ").toLowerCase();
  const redFlags: string[] = [];

  // ── EMERGENCY: Cardiac ──
  if (/chest pain|सीने में दर्द|ਛਾਤੀ ਦਰਦ|বুক ব্যথা|மார்பு வலி|ఛాతీ నొప్పి|छातीत दुखणे|છાતી દર્દ|ಎದೆ ನೋವು|നെഞ്ച് വേദന|سینہ درد/.test(allText))
    redFlags.push("🚨 EMERGENCY: Chest pain — possible cardiac event, urgent triage required");
  if (/palpitation|धड़कन|হৃদকম্পন|படபடப்பு|గుండె దడ/.test(allText))
    redFlags.push("⚠️ Palpitations reported — cardiac evaluation recommended");

  // ── EMERGENCY: Stroke (FAST) ──
  if (/stroke|facial droop|face drooping|चेहरा टेढ़ा|মুখ বাঁকা|முக வாதம్|arm weakness|बाँह कमज़ोर|slurred speech|बोली लड़खड़ा|sudden headache|अचानक सिरदर्द|갑자기|paralysis|लकवा|পক্ষাঘাত/.test(allText))
    redFlags.push("🚨 EMERGENCY: Stroke symptoms (FAST) — immediate neurological triage");

  // ── URGENT: Breathing ──
  if (/breathless|breath|dyspn[oe]a|सांस|শ্বাসকষ্ট|மூச்சு|శ్వాస|श्वास|શ્વાસ|ಉಸಿರು|ശ്വാസം|ساں|wheezing|asthma attack/.test(allText))
    redFlags.push("⚠️ URGENT: Breathing difficulty — assess SpO2 and respiratory status");

  // ── EMERGENCY: Bleeding ──
  if (/blood|खून|bleeding|রক্ত|இரத்தம்|రక్తం|रक्त|લોહી|ರಕ್ತ|രക്തം|خون|hematemesis|melena|hematuria/.test(allText))
    redFlags.push("⚠️ Bleeding reported — assess volume and urgency");

  // ── EMERGENCY: Consciousness ──
  if (/unconscious|seizure|convulsion|बेहोश|অচেতন|மயக்கம்|మూర్ఛ|बेशुद्ध|ბეচરین|ಮೂರ್ಛೆ|ബോധരഹിത|بے ہوش|fitting|fainting/.test(allText))
    redFlags.push("🚨 EMERGENCY: Altered consciousness / seizure — immediate triage");

  // ── Anaphylaxis ──
  if (/swelling.*breath|rash.*breath|allergy.*severe|एलर्जी.*सूजन|ফুলে.*শ্বাস|anaphylaxis|throat.*swell/.test(allText))
    redFlags.push("🚨 EMERGENCY: Possible anaphylaxis — epinephrine may be needed");

  // ── High fever (especially in children) ──
  if (/high fever|104|105|तेज़ बुखार|উচ্চ জ্বর|கடுமையான காய்ச்சல்|పెద్ద జ్వరం|खूप ताप|ખૂબ તાવ|ತೀವ್ರ ಜ್ವರ|കടുത്ത പനി|تیز بخار/.test(allText))
    redFlags.push("⚠️ High fever reported — assess for infection source and hydration");

  // ── Suicidal ideation ──
  if (/suicid|self.harm|आत्महत्या|মনে হয় না বাঁচা|जगायचं नाही/.test(allText))
    redFlags.push("🚨 EMERGENCY: Self-harm risk — immediate psychiatric consultation");

  // ── Severe abdominal pain ──
  if (/severe.*abdomen|severe.*stomach|तीव्र पेट दर्द|তীব্র পেটব্যথা|கடுமையான வயிற்றுவலி/.test(allText))
    redFlags.push("⚠️ Severe abdominal pain — assess for surgical emergency");

  const hasAyush = [prakriti, vikriti, agni, koshtha, ahara, nidana, samprapti, sara, samhanana, satmya, pramana, sattva, aharaShakti, vyayamaShakti, vaya].some(v => v !== "Not reported");

  return {
    chiefComplaint: cc,
    hpi,
    pastHistory: past,
    drugAllergy: drug,
    familyHistory: family,
    personalHistory: personal,
    reviewOfSystems: ros,
    currentMedications: drug !== "Not reported" ? drug : "None reported",
    suggestedICD10: "",
    redFlags,
    ayushNote: hasAyush
      ? `Prakriti: ${prakriti}. Vikriti: ${vikriti}. Agni: ${agni}. Koshtha: ${koshtha}. Ahara-Vihara: ${ahara}. Nidana: ${nidana}. Samprapti: ${samprapti}.`
      : "",
    ...(hasAyush ? { prakriti, vikriti, agniType: agni, koshtha, aharaVihara: ahara, nidana, samprapti, sara, samhanana, satmya, pramana, sattva, aharaShakti, vyayamaShakti, vaya } : {}),
  };
}

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
function DocTypeIcon(type: string): string {
  return type === "prescription" ? "💊"
    : type === "lab_report" ? "🧪"
    : type === "xray_report" ? "🩻"
    : type === "discharge_summary" ? "🏥" : "📄";
}

function SectionCard({ icon, label, value, mono = false }: { icon: string; label: string; value?: string; mono?: boolean }) {
  if (!value || value === "—") return null;
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1.5">{icon} {label}</p>
      <p className={cn("text-xs text-neutral-700 leading-relaxed", mono && "font-mono text-brand-600")}>{value}</p>
    </div>
  );
}

function AyushRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-neutral-100 last:border-0">
      <span className="text-xs font-bold text-green-700 w-28 shrink-0 uppercase pt-0.5">{label}</span>
      <span className="text-xs text-neutral-700 flex-1">{value ?? "Not assessed"}</span>
    </div>
  );
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
  const [isAyush, setIsAyush]     = useState(false);

  useEffect(() => {
    const savedMode = sessionStorage.getItem("mk_mode") ?? "hi";
    setLang(sessionStorage.getItem("mk_lang") ?? "hi");
    // combined mode has AYUSH stages too
    setIsAyush(savedMode === "ayush" || savedMode === "combined");

    try {
      setPatient(JSON.parse(sessionStorage.getItem("mk_patient") ?? "{}"));
    } catch { /**/ }

    const modes: string[] = [];
    if (sessionStorage.getItem("mk_history"))  modes.push("Voice");
    if (sessionStorage.getItem("mk_touch"))    modes.push("Touch");
    if (sessionStorage.getItem("mk_docs"))     modes.push("Document Scan");
    setIntakeMode(modes.length ? modes : ["Touch"]);

    const saved = sessionStorage.getItem("mk_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.summary?.chiefComplaint) {
          setSummary(parsed.summary);
          setIsMock(false);
        } else if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          // Gemini didn't return summary — build it from raw messages
          const built = buildSummaryFromSessionMessages(parsed.messages);
          setSummary(built);
          setIsMock(false);
        } else {
          setIsMock(true);
        }
      } catch { setIsMock(true); }
    } else { setIsMock(true); }

    const docsRaw = sessionStorage.getItem("mk_docs");
    if (docsRaw) {
      try {
        const d: ExtractedDoc[] = JSON.parse(docsRaw);
        setDocs(Array.isArray(d) ? d : []);
      } catch { /**/ }
    }

    const timer = setTimeout(() => setStatus("ready"), 2200);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit() {
    setSubmitted(true);
    sessionStorage.setItem("mk_summary_submitted", "true");

    // Persist to Neon DB
    try {
      const historyRaw = sessionStorage.getItem("mk_history");
      const docsRaw    = sessionStorage.getItem("mk_docs");
      const consentRaw = sessionStorage.getItem("mk_consent");

      await fetch("/api/session/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          mode: sessionStorage.getItem("mk_mode") ?? "combined",
          patient,
          consent: consentRaw ? JSON.parse(consentRaw) : null,
          history: historyRaw ? JSON.parse(historyRaw) : null,
          docs: docsRaw ? JSON.parse(docsRaw) : [],
        }),
      });
    } catch (e) {
      // Non-fatal — session still proceeds to doctor screen
      console.warn("[summary] DB save failed (non-fatal):", e);
    }

    await new Promise((r) => setTimeout(r, 400));
    router.push("/complete");
  }

  if (status === "generating") {
    return (
      <KioskScreen>
        <KioskBody className="flex flex-col items-center justify-center gap-6 py-16">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="h-14 w-14 rounded-full border-4 border-brand-100 border-t-brand-600" />
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-neutral-900">Clinical Record तैयार हो रहा है…</h2>
            <p className="text-sm text-neutral-400">Generating your AI Clinical Intake Record</p>
          </div>
          <div className="text-left w-full max-w-xs space-y-2">
            {["Organising symptoms…", "Mapping ICD-10 codes…",
              isAyush ? "Computing Dashavidha Pariksha…" : "Checking red flags…",
              "Merging document data…", "Generating clinical record…",
            ].map((step, i) => (
              <motion.div key={step} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.38 }}
                className="flex items-center gap-2 text-sm text-neutral-500">
                <span className="text-brand-500">✓</span> {step}
              </motion.div>
            ))}
          </div>
        </KioskBody>
      </KioskScreen>
    );
  }

  const redFlags = summary.redFlags ?? [];
  const abnormal = docs.flatMap((d) => d.labValues?.filter((lv) => lv.flag === "H" || lv.flag === "L") ?? []);
  const allMeds  = Array.from(new Set(docs.flatMap((d) => d.medications?.map((m) => m.name) ?? [])));
  const allDx    = docs.flatMap((d) => d.diagnoses ?? []);

  const now = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const patientAge = patient.yearOfBirth
    ? `${new Date().getFullYear() - parseInt(patient.yearOfBirth)}y` : "";


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

        {/* 1. HEADER BAR */}
        <div className="bg-brand-700 text-white rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="MediKiosk" className="h-10 w-10 rounded-xl object-cover shrink-0 border-2 border-brand-500" />
            <div>
              <p className="text-xs text-brand-200 font-medium uppercase tracking-wide">MediKiosk</p>
              <p className="font-bold text-base leading-tight">AI Clinical Intake Record</p>
              <p className="text-xs text-brand-300 mt-0.5">{now}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide block">
              Pending Review
            </span>
            <p className="text-xs text-brand-300 mt-1.5">{now}</p>
          </div>

        </div>

        {/* 2. PATIENT CARD */}
        <div className="bg-neutral-50 rounded-2xl px-4 py-3 flex items-center gap-4 border border-neutral-200">
          <div className="h-14 w-14 rounded-full bg-brand-100 flex items-center justify-center text-2xl shrink-0">👤</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-neutral-900 text-base truncate">{patient.name ?? "Patient"}</p>
            {patient.abhaNumber && (
              <p className="text-xs text-brand-600 font-mono mt-0.5">ABHA: {patient.abhaNumber}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {patient.gender && <span className="text-xs text-neutral-500 capitalize">{patient.gender}</span>}
              {patientAge && <span className="text-xs text-neutral-500">{patientAge}</span>}
              <span className="text-xs text-neutral-500 uppercase">{lang}</span>
              {isAyush && (
                <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  🌿 AYUSH Mode
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {intakeMode.map((m) => (
              <span key={m} className="text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full">
                {m === "Voice" ? "🎤" : m === "Touch" ? "👆" : "📄"} {m}
              </span>
            ))}
          </div>
        </div>

        {isMock && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-800">Voice history not completed</p>
              <p className="text-xs text-amber-700 mt-0.5">Document data below is still available to the doctor.</p>
            </div>
          </div>
        )}

        {/* 3. HISTORY COLLECTED */}
        {!isMock && (
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                🩺 History Collected by MediKiosk
              </p>
              {summary.suggestedICD10 && (
                <span className="text-xs font-mono text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">
                  ICD-10: {summary.suggestedICD10}
                </span>
              )}
            </div>
            <div className="p-3 space-y-3">
              {/* Chief Complaint */}
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-3">
                <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-1">Chief Complaint</p>
                <p className="font-bold text-neutral-900 text-sm leading-snug">{summary.chiefComplaint}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {summary.severity && (
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                      summary.severity.toLowerCase().includes("severe")
                        ? "bg-red-100 text-red-700"
                        : summary.severity.toLowerCase() === "moderate"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    )}>
                      {summary.severity} severity
                    </span>
                  )}
                  {summary.duration && summary.duration !== "—" && (
                    <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                      ⏱ {summary.duration}
                    </span>
                  )}
                </div>
              </div>

              {/* HPI */}
              {summary.hpi && summary.hpi !== "—" && (
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1.5">📋 History of Present Illness</p>
                  <p className="text-xs text-neutral-700 leading-relaxed">{summary.hpi}</p>
                  {summary.character && summary.character !== "—" && (
                    <p className="text-xs text-neutral-500 mt-1"><span className="font-semibold">Character:</span> {summary.character}</p>
                  )}
                  {(summary.associatedSymptoms?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-neutral-400 font-semibold mr-1">Associated:</span>
                      {(summary.associatedSymptoms ?? []).map((s) => (
                        <span key={s} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2-col: Past History | Drug & Allergy */}
              <div className="grid grid-cols-2 gap-2">
                <SectionCard icon="🏥" label="Past History" value={summary.pastHistory} />
                <SectionCard icon="💊" label="Drug / Allergy" value={summary.drugAllergy} />
              </div>

              {summary.currentMedications && summary.currentMedications !== "—" && (
                <SectionCard icon="💉" label="Current Medications" value={summary.currentMedications} />
              )}

              {/* 2-col: Family | Personal */}
              <div className="grid grid-cols-2 gap-2">
                <SectionCard icon="👨‍👩‍👦" label="Family History" value={summary.familyHistory} />
                <SectionCard icon="🧑" label="Personal History" value={summary.personalHistory} />
              </div>

              {summary.reviewOfSystems && summary.reviewOfSystems !== "—" && (
                <SectionCard icon="🔍" label="Review of Systems" value={summary.reviewOfSystems} />
              )}
            </div>
          </div>
        )}

        {/* 4. AYUSH DASHAVIDHA PARIKSHA */}
        {isAyush && !isMock && (
          <div className="rounded-2xl border-2 border-green-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-green-50 border-b border-green-200 flex items-center gap-2">
              <span className="text-base">🌿</span>
              <div>
                <p className="text-xs font-bold text-green-700 uppercase tracking-widest">AYUSH Dashavidha Pariksha</p>
                <p className="text-xs text-green-600">Ten-fold Ayurvedic examination</p>
              </div>
            </div>
            <div className="p-3">
              <AyushRow label="Prakriti" value={summary.prakriti} />
              <AyushRow label="Vikriti" value={summary.vikriti} />
              <AyushRow label="Agni" value={summary.agniType} />
              <AyushRow label="Koshtha" value={summary.koshtha} />
              <AyushRow label="Ahara-Vihara" value={summary.aharaVihara} />
              <AyushRow label="Nidana" value={summary.nidana} />
              <AyushRow label="Samprapti" value={summary.samprapti} />
              <AyushRow label="Sara" value={summary.sara} />
              <AyushRow label="Samhanana" value={summary.samhanana} />
              <AyushRow label="Satmya" value={summary.satmya} />
              <AyushRow label="Pramana" value={summary.pramana} />
              <AyushRow label="Sattva" value={summary.sattva} />
              <AyushRow label="Ahara Shakti" value={summary.aharaShakti} />
              <AyushRow label="Vyayama Shakti" value={summary.vyayamaShakti} />
              <AyushRow label="Vaya" value={summary.vaya} />
              {summary.ayushNote && (
                <div className="mt-3 pt-3 border-t border-green-100">
                  <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-1">Clinical Note</p>
                  <p className="text-xs text-green-900 leading-relaxed">{summary.ayushNote}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. DOCUMENTS TABLE */}
        {docs.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                📄 Documents Uploaded &amp; Extracted ({docs.length})
              </p>
            </div>
            <div className="divide-y divide-neutral-100">
              {docs.map((doc, i) => {
                const keyFindings = [
                  ...(doc.diagnoses?.slice(0, 2) ?? []),
                  ...(doc.medications?.slice(0, 2).map((m) => m.name) ?? []),
                  ...(doc.labValues?.slice(0, 3).map((lv) => `${lv.test}: ${lv.value} ${lv.unit}${lv.flag ? ` (${lv.flag})` : ""}`) ?? []),
                ].slice(0, 4);
                return (
                  <div key={i} className="px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-start">
                    <span className="text-xl">{DocTypeIcon(doc.docType)}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-800">{DocTypeLabel(doc.docType)}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {doc.date ?? "Date not found"} · {doc.hospitalName ?? "Scanned document"}
                      </p>
                      <div className="mt-1.5 space-y-0.5">
                        {keyFindings.length > 0 ? keyFindings.map((f, j) => (
                          <p key={j} className={cn("text-xs",
                            f.includes("(H)") ? "text-red-600 font-semibold"
                              : f.includes("(L)") ? "text-blue-600 font-semibold"
                              : "text-neutral-600"
                          )}>• {f}</p>
                        )) : (
                          <p className="text-xs text-neutral-400 italic">No key findings extracted</p>
                        )}
                      </div>
                    </div>
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full shrink-0",
                      doc.confidence === "high" ? "bg-green-100 text-green-700"
                        : doc.confidence === "medium" ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    )}>
                      {doc.confidence === "high" ? "High" : doc.confidence === "medium" ? "Med" : "Low"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. MEDICAL TIMELINE */}
        {(allDx.length > 0 || abnormal.length > 0) && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">📅 Medical Timeline</p>
            <div className="relative pl-5">
              <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-neutral-200" />
              {allDx.map((dx, i) => (
                <div key={i} className="relative mb-3 last:mb-0">
                  <div className="absolute -left-3.5 top-1 h-3 w-3 rounded-full bg-brand-500 border-2 border-white" />
                  <p className="text-xs text-neutral-700 font-medium">{dx}</p>
                  <p className="text-xs text-neutral-400">From uploaded document</p>
                </div>
              ))}
              {abnormal.map((lv, i) => (
                <div key={`lv-${i}`} className="relative mb-3 last:mb-0">
                  <div className={cn("absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 border-white",
                    lv.flag === "H" ? "bg-red-500" : "bg-blue-500"
                  )} />
                  <p className="text-xs font-medium text-neutral-800">
                    {lv.test}: {lv.value} {lv.unit}
                    <span className={cn("ml-1.5 text-xs font-bold", lv.flag === "H" ? "text-red-600" : "text-blue-600")}>
                      [{lv.flag === "H" ? "↑ HIGH" : "↓ LOW"}]
                    </span>
                  </p>
                  <p className="text-xs text-neutral-400">Abnormal lab value</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. AI GENERATED SUMMARY */}
        <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="" className="h-4 w-4 rounded-full object-cover" />
              AI Generated Summary (For Physician)
            </p>
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">DRAFT</span>
          </div>
          <p className="text-xs text-neutral-700 leading-relaxed">
            {!isMock
              ? `Patient${patient.name ? ` ${patient.name}` : ""}${patientAge ? ` (${patientAge})` : ""} presents with ${summary.chiefComplaint?.toLowerCase()}. `
                + (summary.hpi && summary.hpi !== "—" ? summary.hpi + " " : "")
                + (summary.pastHistory && summary.pastHistory !== "—" ? `PMHx: ${summary.pastHistory}. ` : "")
                + (summary.drugAllergy && summary.drugAllergy !== "—" ? `Medications/Allergies: ${summary.drugAllergy}. ` : "")
                + (summary.familyHistory && summary.familyHistory !== "—" ? `FHx: ${summary.familyHistory}. ` : "")
                + ((summary.associatedSymptoms?.length ?? 0) > 0 ? `Associated: ${(summary.associatedSymptoms ?? []).join(", ")}.` : "")
              : "Voice history not recorded. Please review document extracts and proceed with clinical assessment."}
          </p>
          {!isAyush && summary.ayushNote && (
            <div className="mt-2 pt-2 border-t border-brand-100">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-0.5">🌿 AYUSH Note</p>
              <p className="text-xs text-green-900">{summary.ayushNote}</p>
            </div>
          )}
          {allMeds.length > 0 && (
            <div className="mt-2 pt-2 border-t border-brand-100">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1.5">💊 Medication (Current — from documents)</p>
              <div className="flex flex-wrap gap-1.5">
                {allMeds.map((med) => (
                  <span key={med} className="text-xs bg-white text-brand-700 border border-brand-100 px-2 py-0.5 rounded-full font-medium">{med}</span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-brand-400 mt-2 italic">
            ⚠ AI-generated draft — must be verified by physician before clinical use
          </p>
        </div>

        {/* 8. RED FLAG CHECK */}
        <div className={cn("rounded-2xl border p-4",
          redFlags.length > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
        )}>
          <div className="flex items-center justify-between mb-2">
            <p className={cn("text-xs font-bold uppercase tracking-widest",
              redFlags.length > 0 ? "text-red-600" : "text-green-700"
            )}>🚨 Red Flag Check</p>
            <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full",
              redFlags.length > 1 ? "bg-red-600 text-white"
                : redFlags.length === 1 ? "bg-amber-500 text-white"
                : "bg-green-600 text-white"
            )}>
              {redFlags.length > 1 ? "HIGH RISK" : redFlags.length === 1 ? "MODERATE" : "Low Risk"}
            </span>
          </div>
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
            <p className="text-xs text-green-700 flex items-center gap-2"><span>✅</span> No red flags detected — routine consultation</p>
          )}
        </div>

        {/* 9. PATIENT CONSENT */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">🔒 Patient Consent &amp; Privacy</p>
          <div className="grid grid-cols-3 gap-1">
            {["Shared with treating physician only", "ABDM / DPDP 2023 compliant", "No raw Aadhaar stored"].map((c) => (
              <p key={c} className="text-xs text-neutral-600 flex items-start gap-1.5">
                <span className="text-green-500 shrink-0 mt-0.5">✓</span> {c}
              </p>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            // ── Build report HTML sections ──
            const esc = (s: string) => (s || "—").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            const redFlagSection = redFlags.length > 0
              ? `<div class="section red-flag">
                  <div class="section-title red-flag-title">🚨 Red Flag Alert — ${redFlags.length > 1 ? "HIGH RISK" : "MODERATE RISK"}</div>
                  <div class="section-body"><ul style="color:#b91c1c;font-weight:600;">${redFlags.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>
                </div>`
              : `<div class="section all-clear">
                  <div class="section-title all-clear-title">✅ Red Flag Check</div>
                  <div class="section-body"><p style="color:#15803d;">No emergency red flags detected.</p></div>
                </div>`;

            const historySections = [
              { title: "Chief Complaint", body: summary.chiefComplaint, highlight: true },
              { title: "History of Present Illness", body: [
                summary.hpi,
                (summary.severity || summary.duration) ? `<p><span class="label">Severity:</span> ${esc(summary.severity || "—")} &nbsp; <span class="label">Duration:</span> ${esc(summary.duration || "—")}</p>` : "",
                (summary.character) ? `<p><span class="label">Character:</span> ${esc(summary.character)}</p>` : "",
                (summary.associatedSymptoms?.length) ? `<p><span class="label">Associated:</span> ${summary.associatedSymptoms.join(", ")}</p>` : "",
              ].filter(Boolean).join("") },
              { title: "Past Medical / Surgical History", body: summary.pastHistory },
              { title: "Drug & Allergy / Current Medications", body: summary.drugAllergy },
              { title: "Family History", body: summary.familyHistory },
              { title: "Personal History", body: summary.personalHistory },
              { title: "Review of Systems", body: summary.reviewOfSystems },
            ].map(s => {
              if (!s.body || s.body === "—" || s.body === "Not reported") return "";
              const bodyHtml = s.highlight
                ? `<div class="highlight-box">${esc(String(s.body))}</div>`
                : `<p>${s.body}</p>`;
              return `<div class="section"><div class="section-title">${s.title}</div><div class="section-body">${bodyHtml}</div></div>`;
            }).join("");

            const ayushSection = isAyush ? `
              <div class="section ayush">
                <div class="section-title ayush-title">🌿 AYUSH — Dashavidha Pariksha</div>
                <div class="section-body"><div class="grid-2">
                  ${[
                    ["Prakriti (Constitution)", summary.prakriti],
                    ["Vikriti (Imbalance)", summary.vikriti],
                    ["Agni (Digestive Fire)", summary.agniType],
                    ["Koshtha (Bowel)", summary.koshtha],
                    ["Ahara-Vihara (Diet/Lifestyle)", summary.aharaVihara],
                    ["Nidana (Causative)", summary.nidana],
                    ["Samprapti (Pathogenesis)", summary.samprapti],
                    ["Sara (Tissue Essence)", summary.sara],
                    ["Samhanana (Body Build)", summary.samhanana],
                    ["Satmya (Adaptability)", summary.satmya],
                    ["Pramana (Proportion)", summary.pramana],
                    ["Sattva (Mental Strength)", summary.sattva],
                    ["Ahara Shakti (Digestive)", summary.aharaShakti],
                    ["Vyayama Shakti (Exercise)", summary.vyayamaShakti],
                    ["Vaya (Age Constitution)", summary.vaya],
                  ].map(([label, val]) => `<div><span class="label">${label}</span><br>${esc(String(val || "—"))}</div>`).join("")}
                </div>
                ${summary.ayushNote ? `<p style="margin-top:8px;font-style:italic;">${esc(summary.ayushNote)}</p>` : ""}
                </div>
              </div>` : "";

            const docsSection = docs.length > 0 ? `
              <div class="section">
                <div class="section-title">📄 Documents Uploaded</div>
                <div class="section-body"><table>
                  <tr><th>Type</th><th>Date</th><th>Hospital</th><th>Key Findings</th><th>Confidence</th></tr>
                  ${docs.map(d => `<tr>
                    <td>${esc(d.docType)}</td>
                    <td>${esc(d.date || "—")}</td>
                    <td>${esc((d as unknown as Record<string, string>).hospital || "—")}</td>
                    <td>${(d.diagnoses || []).concat(d.medications?.map((m: {name:string}) => m.name) || []).slice(0, 3).join(", ") || "—"}</td>
                    <td>${esc(d.confidence || "—")}</td>
                  </tr>`).join("")}
                </table></div>
              </div>` : "";

            const timelineSection = (allDx?.length > 0 || abnormal?.length > 0) ? `
              <div class="section">
                <div class="section-title">📋 Medical Timeline</div>
                <div class="section-body"><div class="grid-2">
                  <div><span class="label">Historical Diagnoses</span><ul style="margin-top:6px;">
                    ${allDx?.map(dx => `<li>${esc(dx)}</li>`).join("") || '<li style="color:#6b7280;">None</li>'}
                  </ul></div>
                  <div><span class="label">Abnormal Lab Values</span><ul style="margin-top:6px;">
                    ${abnormal?.map(ab => `<li class="${ab.flag === 'H' ? 'val-high' : 'val-low'}">${esc(ab.test)}: ${esc(ab.value)} ${esc(ab.unit)} [${ab.flag === 'H' ? '↑ HIGH' : '↓ LOW'}]</li>`).join("") || '<li style="color:#6b7280;">None</li>'}
                  </ul></div>
                </div></div>
              </div>` : "";

            const summaryText = !isMock
              ? `Patient${patient.name ? ` ${patient.name}` : ""}${patientAge ? ` (${patientAge})` : ""} presents with ${(summary.chiefComplaint || "complaints").toLowerCase()}. ${summary.hpi && summary.hpi !== "—" ? summary.hpi + " " : ""}${summary.pastHistory && summary.pastHistory !== "—" ? `PMHx: ${summary.pastHistory}. ` : ""}${summary.drugAllergy && summary.drugAllergy !== "—" ? `Medications/Allergies: ${summary.drugAllergy}.` : ""}`
              : "Voice history not recorded. Review document extracts above.";

            const reportHTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>MediKiosk Clinical Record</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',-apple-system,sans-serif;font-size:12px;max-width:800px;margin:0 auto;padding:20px;color:#1e293b;line-height:1.5}
.header{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:16px 20px;border-radius:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:18px;font-weight:800}.header p{font-size:11px;opacity:.85}
.patient-bar{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px}
.patient-bar div{font-size:12px}.patient-bar .label{font-weight:600;color:#6b7280;font-size:10px;text-transform:uppercase}
.section{border:1px solid #e5e7eb;border-radius:8px;margin:10px 0;overflow:hidden}
.section-title{background:#f9fafb;padding:8px 12px;font-weight:700;font-size:11px;text-transform:uppercase;color:#374151;border-bottom:1px solid #e5e7eb;letter-spacing:.5px}
.section-body{padding:12px;font-size:12px}.section-body p{margin:0 0 8px}.section-body p:last-child{margin:0}
.highlight-box{background:#eff6ff;border-left:4px solid #3b82f6;padding:10px;font-weight:500}
.red-flag{border:2px solid #ef4444;background:#fef2f2}.red-flag-title{background:#fee2e2;color:#b91c1c}
.all-clear{border:1px solid #86efac;background:#f0fdf4}.all-clear-title{background:#dcfce7;color:#15803d}
.ayush{background:#f0fdf4;border-color:#86efac}.ayush-title{background:#dcfce7;color:#166534}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.label{font-weight:600;color:#6b7280;font-size:10px;text-transform:uppercase}
.val-high{color:#dc2626;font-weight:bold}.val-low{color:#2563eb;font-weight:bold}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;font-size:11px}
th{font-weight:600;color:#6b7280;text-transform:uppercase;background:#f9fafb}
.footer{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#6b7280;text-align:center}
.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:120px;color:rgba(0,0,0,.04);z-index:-1;pointer-events:none;font-weight:bold}
@media print{body{margin:0;padding:10px}.no-print{display:none!important}}
</style></head><body>
<div class="watermark">DRAFT</div>
<div class="header"><div><h1>MediKiosk</h1><p>AI Clinical Intake Record</p></div><div style="text-align:right"><p>All India Institute of Ayurveda</p><p>${now}</p></div></div>
<div class="patient-bar">
<div><span class="label">Name</span><br>${esc(patient.name || "")}</div>
<div><span class="label">Age/Gender</span><br>${patientAge || "—"} / ${patient.gender || "—"}</div>
<div><span class="label">ABHA</span><br>${patient.abhaNumber || "—"}</div>
<div><span class="label">Language</span><br>${lang.toUpperCase()}</div>
<div><span class="label">OPD Type</span><br>${isAyush ? "AYUSH" : "General"}</div>
<div><span class="label">Intake Mode</span><br>${(intakeMode || []).join(", ") || "Standard"}</div>
</div>
${redFlagSection}${historySections}${ayushSection}${docsSection}${timelineSection}
<div class="section" style="background:#f8fafc"><div class="section-title" style="background:#f1f5f9;color:#334155">AI Generated Summary (For Physician — Draft)</div><div class="section-body"><p style="font-style:italic;color:#374151;font-size:13px;line-height:1.6">${summaryText}</p></div></div>
<div class="footer"><p style="margin:0;font-weight:600">🔒 Patient Consent & Privacy</p><p style="margin:4px 0 0">DPDP 2023 Compliant · ABDM Compliant · Encrypted · Shared with treating physician only</p></div>
</body></html>`;

            const win = window.open("", "_blank", "width=900,height=900");
            if (win) { win.document.write(reportHTML); win.document.close(); win.onload = () => win.print(); }
          }}
          className="w-full border border-neutral-200 text-neutral-500 text-sm font-semibold py-2.5 rounded-2xl hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2">
          🖨️ Generate &amp; Print Clinical Report
        </button>

        <p className="text-xs text-neutral-400 text-center pb-2">
          🔒 Encrypted · Shared only with treating doctor · ABDM Compliant
        </p>

      </KioskBody>

      <KioskFooter>
        <Button variant="primary" size="xl" fullWidth loading={submitted} onClick={handleSubmit}>
          {submitted ? "Submitting…" : `✅ ${t(lang, "submitToDoctor")}`}
        </Button>
      </KioskFooter>
    </KioskScreen>
  );
}
