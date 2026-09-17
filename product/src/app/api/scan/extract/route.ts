// src/app/api/scan/extract/route.ts
// Gemini Vision — extract structured data from medical documents
// Handles: prescriptions, lab reports, discharge summaries, X-rays, PDFs
// Input: base64 image/pdf + document type
// Output: structured JSON with medications, vitals, diagnoses, lab values

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export type DocType =
  | "prescription"
  | "lab_report"
  | "discharge_summary"
  | "xray_report"
  | "other";

export interface ExtractedDoc {
  docType: DocType;
  medications: Array<{
    name: string;
    dose: string;
    frequency: string;
    duration: string;
  }>;
  vitals: {
    BP?: string;
    temperature?: string;
    SpO2?: string;
    pulse?: string;
    weight?: string;
    height?: string;
    RBS?: string;
  };
  diagnoses: string[];
  labValues: Array<{
    test: string;
    value: string;
    unit: string;
    reference: string;
    flag: "H" | "L" | "N" | ""; // High, Low, Normal, unknown
  }>;
  doctorName?: string;
  hospitalName?: string;
  date?: string;
  notes?: string;
  confidence: "high" | "medium" | "low";
}

const COMMON_OCR_INSTRUCTIONS = `
The document may be rotated, skewed, or photographed at an angle. Correct for orientation before reading.
The document may contain text in Hindi, English, or regional Indian languages. Extract all text regardless of language.
This document may be handwritten. Try multiple reading passes. Sound out abbreviated words. Common Indian prescription abbreviations: BD=twice daily, TDS=thrice daily, OD=once daily, SOS=as needed, HS=at bedtime, AC=before food, PC=after food, Inj=Injection, Tab=Tablet, Cap=Capsule, Syr=Syrup, Oint=Ointment.
`;

const DOC_PROMPTS: Record<DocType, string> = {
  prescription: `Extract ALL clinical and medication information from this medical prescription (printed or handwritten).
${COMMON_OCR_INSTRUCTIONS}
Common Indian drug names include Paracetamol, Amoxicillin, Azithromycin, Metformin, Amlodipine, Omeprazole, Pantoprazole, Crocin, Dolo, Combiflam, Augmentin. Verify extracted drug names against common medications.
Even if the document is partially blurred or handwritten, transcribe everything readable.
Return ONLY valid JSON with this exact schema:
{
  "docType": "prescription",
  "medications": [{"name": "drug name", "dose": "500mg", "frequency": "BD/TDS/OD/SOS", "duration": "5 days"}],
  "vitals": {"BP": "", "temperature": "", "SpO2": "", "pulse": "", "weight": "", "height": "", "RBS": ""},
  "diagnoses": ["diagnosis 1"],
  "labValues": [],
  "doctorName": "Dr. Name if visible",
  "hospitalName": "Hospital/Clinic name if visible",
  "date": "DD/MM/YYYY if visible",
  "notes": "Any clinical advice or notes",
  "confidence": "high|medium|low"
}`,

  lab_report: `Extract ALL laboratory investigations, blood tests, pathology metrics from this lab report.
${COMMON_OCR_INSTRUCTIONS}
For each lab value, determine if it's High (H), Low (L), or Normal (N) by comparing with the reference range. If reference range is not on the document, use standard medical reference ranges.
Even if the document is scanned, photographed, or slightly blurred, identify the test names, observed values, units, reference intervals, and whether it is High (H), Low (L), or Normal (N).
Return ONLY valid JSON with this exact schema:
{
  "docType": "lab_report",
  "medications": [],
  "vitals": {"RBS": "value if present"},
  "diagnoses": [],
  "labValues": [
    {"test": "Hemoglobin", "value": "11.2", "unit": "g/dL", "reference": "13.0-17.0", "flag": "L"},
    {"test": "Platelet Count", "value": "1.8", "unit": "Lakhs/cumm", "reference": "1.5-4.5", "flag": "N"}
  ],
  "doctorName": "Referring Doctor if visible",
  "hospitalName": "Laboratory or Diagnostic center name",
  "date": "Date of collection/reporting",
  "notes": "Key impression or findings",
  "confidence": "high|medium|low"
}`,

  discharge_summary: `Extract ALL clinical information from this hospital discharge summary.
${COMMON_OCR_INSTRUCTIONS}
Return ONLY valid JSON with this exact schema:
{
  "docType": "discharge_summary",
  "medications": [{"name": "Medicine", "dose": "500mg", "frequency": "OD", "duration": "10 days"}],
  "vitals": {"BP": "", "temperature": "", "SpO2": "", "pulse": "", "weight": "", "height": "", "RBS": ""},
  "diagnoses": ["Primary diagnosis", "Secondary diagnoses"],
  "labValues": [{"test": "", "value": "", "unit": "", "reference": "", "flag": ""}],
  "doctorName": "Treating consultant",
  "hospitalName": "Hospital name",
  "date": "Discharge date",
  "notes": "Advice on discharge, follow-up date",
  "confidence": "high|medium|low"
}`,

  xray_report: `Extract radiological impression and diagnostic findings from this radiology/X-ray/CT/MRI report.
${COMMON_OCR_INSTRUCTIONS}
Return ONLY valid JSON with this exact schema:
{
  "docType": "xray_report",
  "medications": [],
  "vitals": {},
  "diagnoses": ["Radiological impression"],
  "labValues": [],
  "doctorName": "Radiologist name",
  "hospitalName": "Imaging center",
  "date": "Scan date",
  "notes": "Findings and summary",
  "confidence": "high|medium|low"
}`,

  other: `Extract any clinical or diagnostic information from this medical document.
${COMMON_OCR_INSTRUCTIONS}
Return ONLY valid JSON with this exact schema:
{
  "docType": "other",
  "medications": [],
  "vitals": {},
  "diagnoses": ["Key findings"],
  "labValues": [],
  "doctorName": "",
  "hospitalName": "",
  "date": "",
  "notes": "Key clinical summary",
  "confidence": "high|medium|low"
}`,
};

// Helper function to fix common OCR errors in dosages (e.g. "5OOmg" -> "500mg")
function fixOcrDosage(dose: string): string {
  if (!dose) return dose;
  return dose
    .replace(/(\\d)[Oo]+/g, (match) => match.replace(/[Oo]/g, "0"))
    .replace(/^[Oo]+(\\d)/, (match) => match.replace(/[Oo]/g, "0"));
}

// ── Resilient JSON parser ─────────────────────────────────────────
function parseModelJson(raw: string): any {
  // 1. Try matching ```json ... ``` block
  const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (blockMatch && blockMatch[1]) {
    try {
      return JSON.parse(blockMatch[1].trim());
    } catch {
      // continue
    }
  }

  // 2. Find outermost { and }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.substring(start, end + 1).trim());
    } catch {
      // continue
    }
  }

  // 3. Direct attempt after clean
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const {
      imageBase64,
      mimeType,
      docType,
    }: {
      imageBase64: string;
      mimeType: string;
      docType: DocType;
    } = await req.json();

    if (!imageBase64 || !docType) {
      return NextResponse.json(
        { error: "Document data and type are required" },
        { status: 400 }
      );
    }

    // Clean mimeType (remove charset or params)
    let cleanMime = (mimeType || "image/jpeg").split(";")[0].trim();
    if (!cleanMime || cleanMime === "application/octet-stream") {
      cleanMime = "image/jpeg";
    }

    // ── Server-side MIME allowlist ────────────────────────────────────────────
    // Only accept specific medical document formats. Reject everything else.
    const ALLOWED_MIMES = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);
    if (!ALLOWED_MIMES.has(cleanMime)) {
      return NextResponse.json(
        { error: `File type '${cleanMime}' is not supported. Please upload JPEG, PNG, WebP or PDF.` },
        { status: 415 }
      );
    }

    // ── Basic size check on the base64 payload ────────────────────────────
    // 100 MB raw ≈ ~136 MB base64. Reject obviously oversized payloads.
    if (imageBase64.length > 140_000_000) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 100 MB." },
        { status: 413 }
      );
    }

    const prompt = DOC_PROMPTS[docType] ?? DOC_PROMPTS.other;
    const parts = [
      {
        inlineData: {
          mimeType: cleanMime,
          data: imageBase64,
        },
      },
      {
        text: `${prompt}\nIMPORTANT: Respond with the JSON object ONLY. No markdown conversational commentary before or after.`,
      },
    ];

    const modelsToTry = [
      process.env.GEMINI_MODEL,
      "gemini-2.5-flash",
      "gemini-1.5-flash",
    ].filter(Boolean) as string[];

    let response: any = null;
    let lastErr: any = null;
    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
        });
        if (response?.text) break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[scan/extract] Model ${model} failed, trying next...`);
      }
    }

    if (!response && lastErr) throw lastErr;

    const raw = response.text ?? "";
    console.log("[scan/extract] Raw response length:", raw.length);

    try {
      let extracted: ExtractedDoc = parseModelJson(raw);
      // Ensure required structure fields exist
      extracted.docType = extracted.docType || docType;
      extracted.medications = Array.isArray(extracted.medications) ? extracted.medications : [];
      extracted.labValues = Array.isArray(extracted.labValues) ? extracted.labValues : [];
      extracted.diagnoses = Array.isArray(extracted.diagnoses) ? extracted.diagnoses : [];
      extracted.vitals = extracted.vitals || {};
      extracted.confidence = extracted.confidence || "medium";

      // ── Multi-pass extraction for low confidence ──
      if (extracted.confidence === "low" && extracted.medications.length === 0 && extracted.labValues.length === 0) {
        console.log("[scan/extract] Confidence is low, attempting second pass with enhanced prompt.");
        const retryPrompt = `The previous extraction had low confidence. Please re-examine this document more carefully. Focus on:\n1. Any medication names (even partially readable)\n2. Any numerical values that could be lab results\n3. Any dates\n4. Doctor or hospital names\n${prompt}`;
        
        const retryParts = [
          {
            inlineData: {
              mimeType: cleanMime,
              data: imageBase64,
            },
          },
          {
            text: `${retryPrompt}\nIMPORTANT: Respond with the JSON object ONLY. No markdown conversational commentary before or after.`,
          },
        ];

        let retryResponse: any = null;
        for (const model of modelsToTry) {
          try {
            retryResponse = await ai.models.generateContent({
              model,
              contents: [{ role: "user", parts: retryParts }],
            });
            if (retryResponse?.text) break;
          } catch (err: any) {
            console.warn(`[scan/extract] Retry Model ${model} failed, trying next...`);
          }
        }
        
        if (retryResponse && retryResponse.text) {
          try {
            const retryExtracted: ExtractedDoc = parseModelJson(retryResponse.text);
            retryExtracted.docType = retryExtracted.docType || docType;
            retryExtracted.medications = Array.isArray(retryExtracted.medications) ? retryExtracted.medications : [];
            retryExtracted.labValues = Array.isArray(retryExtracted.labValues) ? retryExtracted.labValues : [];
            retryExtracted.diagnoses = Array.isArray(retryExtracted.diagnoses) ? retryExtracted.diagnoses : [];
            retryExtracted.vitals = retryExtracted.vitals || {};
            retryExtracted.confidence = retryExtracted.confidence || "medium";
            
            // If the retry found something, use it
            if (retryExtracted.medications.length > 0 || retryExtracted.labValues.length > 0 || retryExtracted.confidence !== "low") {
                extracted = retryExtracted;
            }
          } catch (retryError) {
             console.warn("[scan/extract] Retry JSON parse failed, sticking to first extraction.");
          }
        }
      }

      // ── Apply Dosage Validation ──
      extracted.medications = extracted.medications.map(med => ({
        ...med,
        dose: fixOcrDosage(med.dose)
      }));

      return NextResponse.json({ success: true, data: extracted });
    } catch (parseError) {
      console.warn("[scan/extract] JSON parse failed, returning fallback extraction. Raw:", raw.slice(0, 300));
      // Fallback extraction so workflow never completely fails on noisy/blurry documents
      const fallback: ExtractedDoc = {
        docType,
        medications: [],
        vitals: {},
        diagnoses: ["Document analyzed with low confidence"],
        labValues: [],
        notes: raw.slice(0, 400).replace(/[`{}"[\]]/g, " ").trim() || "Analyzed document",
        confidence: "low",
      };
      return NextResponse.json({ success: true, data: fallback });
    }
  } catch (err: any) {
    console.error("[scan/extract] error:", err?.message || err);
    return NextResponse.json(
      { error: "Extraction failed. Please ensure file is valid image or PDF under 100 MB." },
      { status: 500 }
    );
  }
}
