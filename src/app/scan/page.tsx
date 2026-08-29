"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  KioskHeader,
  KioskScreen,
  KioskBody,
  KioskFooter,
} from "@/components/kiosk/KioskLayout";
import { Button, Card, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface UploadedDoc {
  id: string;
  name: string;
  type: "prescription" | "lab_report" | "discharge_summary" | "other";
  status: "uploading" | "processing" | "done" | "error";
  preview?: string;
  extracted?: {
    date?: string;
    doctor?: string;
    diagnoses?: string[];
    medications?: string[];
  };
}

const DOC_TYPES = [
  { id: "prescription",       icon: "💊", label: "नुस्खा / Prescription" },
  { id: "lab_report",         icon: "🧪", label: "जांच रिपोर्ट / Lab Report" },
  { id: "discharge_summary",  icon: "🏥", label: "Discharge Summary" },
  { id: "other",              icon: "📄", label: "अन्य / Other" },
] as const;

export default function ScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [selectedType, setSelectedType] = useState<UploadedDoc["type"]>("prescription");
  const [showTypePicker, setShowTypePicker] = useState(false);

  // ── Simulate file upload + mock OCR processing ─────────────────
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    const file = files[0];
    const id = Date.now().toString();
    const preview = URL.createObjectURL(file);

    // Add document in "uploading" state
    const newDoc: UploadedDoc = {
      id,
      name: file.name,
      type: selectedType,
      status: "uploading",
      preview,
    };
    setDocs((d) => [...d, newDoc]);
    setShowTypePicker(false);

    // Simulate upload (0.8s)
    await new Promise((r) => setTimeout(r, 800));
    setDocs((d) => d.map((doc) => doc.id === id ? { ...doc, status: "processing" } : doc));

    // Simulate OCR processing (1.5s)
    await new Promise((r) => setTimeout(r, 1500));
    setDocs((d) =>
      d.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              status: "done",
              extracted: {
                date: "15 Aug 2026",
                doctor: "Dr. Sharma",
                diagnoses: ["Hypertension", "Type 2 Diabetes"],
                medications: ["Metformin 500mg BD", "Amlodipine 5mg OD"],
              },
            }
          : doc
      )
    );
  }

  function removeDoc(id: string) {
    setDocs((d) => d.filter((doc) => doc.id !== id));
  }

  function handleContinue() {
    sessionStorage.setItem("mk_docs", JSON.stringify(docs.map((d) => ({ id: d.id, type: d.type, extracted: d.extracted }))));
    router.push("/summary");
  }

  return (
    <KioskScreen>
      <KioskHeader
        title="कागजात अपलोड करें"
        subtitle="Upload your medical documents — Step 5 of 6"
        onBack={() => router.push("/history")}
        progress={82}
        stepLabel="Step 5 of 6"
      />

      <KioskBody className="space-y-5">
        {/* Upload action */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setShowTypePicker(true); }}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-dashed
                       border-brand-300 bg-brand-50 hover:bg-brand-100 transition-all
                       hover:border-brand-500 active:scale-95 min-h-[100px]"
          >
            <span className="text-3xl">📷</span>
            <span className="font-semibold text-brand-700 text-sm">
              फोटो लें / Capture
            </span>
          </button>
          <button
            onClick={() => { setShowTypePicker(true); }}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-dashed
                       border-neutral-300 bg-neutral-50 hover:bg-neutral-100 transition-all
                       hover:border-neutral-400 active:scale-95 min-h-[100px]"
          >
            <span className="text-3xl">📁</span>
            <span className="font-semibold text-neutral-600 text-sm">
              गैलरी / Gallery
            </span>
          </button>
        </div>

        {/* Type picker modal */}
        <AnimatePresence>
          {showTypePicker && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="bg-white border border-neutral-200 rounded-2xl shadow-elevated p-4 space-y-2"
            >
              <p className="text-sm font-semibold text-neutral-700 mb-3">
                कागज का प्रकार चुनें / Select document type:
              </p>
              {DOC_TYPES.map((dt) => (
                <button
                  key={dt.id}
                  onClick={() => {
                    setSelectedType(dt.id as UploadedDoc["type"]);
                    fileInputRef.current?.click();
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                    selectedType === dt.id
                      ? "bg-brand-50 border border-brand-200"
                      : "hover:bg-neutral-50 border border-transparent"
                  )}
                >
                  <span className="text-2xl">{dt.icon}</span>
                  <span className="font-semibold text-neutral-800">{dt.label}</span>
                </button>
              ))}
              <button
                onClick={() => setShowTypePicker(false)}
                className="w-full text-center text-sm text-neutral-400 py-2 hover:text-neutral-600"
              >
                रद्द करें / Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Uploaded documents list */}
        {docs.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-neutral-700 text-sm">
              Uploaded Documents ({docs.length})
            </h3>
            {docs.map((doc) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <Card elevated className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Preview thumbnail */}
                    {doc.preview && (
                      <img
                        src={doc.preview}
                        alt="doc"
                        className="w-16 h-16 rounded-xl object-cover border border-neutral-200 shrink-0"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-neutral-900 text-sm truncate">
                          {DOC_TYPES.find((t) => t.id === doc.type)?.icon}{" "}
                          {DOC_TYPES.find((t) => t.id === doc.type)?.label}
                        </p>
                        <button
                          onClick={() => removeDoc(doc.id)}
                          className="text-neutral-400 hover:text-error-600 text-lg shrink-0"
                          aria-label="Remove document"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Status */}
                      {doc.status === "uploading" && (
                        <div className="flex items-center gap-2 mt-2">
                          <Spinner className="h-4 w-4" />
                          <span className="text-xs text-neutral-500">Uploading...</span>
                        </div>
                      )}
                      {doc.status === "processing" && (
                        <div className="flex items-center gap-2 mt-2">
                          <Spinner className="h-4 w-4" />
                          <span className="text-xs text-brand-600 font-medium">
                            🔍 AI reading document...
                          </span>
                        </div>
                      )}
                      {doc.status === "done" && doc.extracted && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-success-600 font-semibold">
                            ✅ Extracted successfully
                          </p>
                          {doc.extracted.doctor && (
                            <p className="text-xs text-neutral-600">
                              👨‍⚕️ {doc.extracted.doctor} · {doc.extracted.date}
                            </p>
                          )}
                          {doc.extracted.medications && doc.extracted.medications.length > 0 && (
                            <p className="text-xs text-neutral-500">
                              💊 {doc.extracted.medications.slice(0, 2).join(", ")}
                              {doc.extracted.medications.length > 2 && ` +${doc.extracted.medications.length - 2} more`}
                            </p>
                          )}
                          {doc.extracted.diagnoses && doc.extracted.diagnoses.length > 0 && (
                            <p className="text-xs text-neutral-500">
                              🏥 {doc.extracted.diagnoses.join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {docs.length === 0 && (
          <div className="text-center py-8 text-neutral-400">
            <p className="text-4xl mb-2">📂</p>
            <p className="text-sm">
              कोई पुराना नुस्खा या रिपोर्ट है तो यहाँ अपलोड करें
            </p>
            <p className="text-xs mt-1">
              Upload any old prescriptions or lab reports
            </p>
          </div>
        )}
      </KioskBody>

      <KioskFooter>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            size="lg"
            onClick={handleContinue}
            className="flex-1"
          >
            ⏭️ स्किप / Skip
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleContinue}
            className="flex-2 flex-1"
            disabled={docs.some((d) => d.status === "uploading" || d.status === "processing")}
          >
            आगे बढ़ें / Next →
          </Button>
        </div>
      </KioskFooter>
    </KioskScreen>
  );
}
