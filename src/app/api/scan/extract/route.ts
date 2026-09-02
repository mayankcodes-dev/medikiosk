// src/app/api/scan/extract/route.ts
// Gemini Vision — extract structured data from medical documents
// Handles: prescriptions, lab reports, discharge summaries, X-rays
// Input: base64 image + document type
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

const DOC_PROMPTS: Record<DocType, string> = {
  prescription: `Extract ALL information from this Indian medical prescription image.
Return ONLY valid JSON matching this exact schema:
{
  "docType": "prescription",
  "medications": [{"name": "drug name", "dose": "500mg", "frequency": "BD/TDS/OD/SOS", "duration": "5 days"}],
  "vitals": {"BP": "120/80", "temperature": "", "SpO2": "", "pulse": "", "weight": "", "height": "", "RBS": ""},
  "diagnoses": ["diagnosis 1", "diagnosis 2"],
  "labValues": [],
  "doctorName": "Dr. Name",
  "hospitalName": "Hospital name if visible",
  "date": "DD/MM/YYYY if visible",
  "notes": "Any special instructions",
  "confidence": "high|medium|low"
}
Note: Indian prescriptions are often handwritten. Do your best. Use confidence: "low" if handwriting is unclear.`,

  lab_report: `Extract ALL lab values from this Indian pathology/laboratory report image.
Return ONLY valid JSON:
{
  "docType": "lab_report",
  "medications": [],
  "vitals": {"RBS": "value if present"},
  "diagnoses": [],
  "labValues": [
    {"test": "Haemoglobin", "value": "11.2", "unit": "g/dL", "reference": "13-17", "flag": "L"},
    {"test": "Platelet Count", "value": "1.8", "unit": "Lakhs/cumm", "reference": "1.5-4.5", "flag": "N"}
  ],
  "doctorName": "",
  "hospitalName": "Lab/hospital name",
  "date": "date of report",
  "notes": "any clinical notes",
  "confidence": "high|medium|low"
}
Flag: "H" = above reference, "L" = below reference, "N" = normal, "" = unknown.`,

  discharge_summary: `Extract ALL clinical information from this hospital discharge summary.
Return ONLY valid JSON:
{
  "docType": "discharge_summary",
  "medications": [{"name": "", "dose": "", "frequency": "", "duration": ""}],
  "vitals": {"BP": "", "temperature": "", "SpO2": "", "pulse": "", "weight": "", "height": "", "RBS": ""},
  "diagnoses": ["Primary diagnosis", "Secondary diagnoses"],
  "labValues": [{"test": "", "value": "", "unit": "", "reference": "", "flag": ""}],
  "doctorName": "Treating doctor",
  "hospitalName": "Hospital name",
  "date": "Date of discharge",
  "notes": "Follow-up instructions, diet advice",
  "confidence": "high|medium|low"
}`,

  xray_report: `Extract information from this X-ray/radiology report.
Return ONLY valid JSON:
{
  "docType": "xray_report",
  "medications": [],
  "vitals": {},
  "diagnoses": ["radiological findings as diagnoses"],
  "labValues": [],
  "doctorName": "Radiologist name",
  "hospitalName": "",
  "date": "",
  "notes": "Impression / recommendation",
  "confidence": "high|medium|low"
}`,

  other: `Extract any medical information visible in this document image.
Return ONLY valid JSON:
{
  "docType": "other",
  "medications": [],
  "vitals": {},
  "diagnoses": [],
  "labValues": [],
  "doctorName": "",
  "hospitalName": "",
  "date": "",
  "notes": "Key information found in the document",
  "confidence": "high|medium|low"
}`,
};

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, docType }: {
      imageBase64: string;
      mimeType: string;
      docType: DocType;
    } = await req.json();

    if (!imageBase64 || !docType) {
      return NextResponse.json(
        { error: "imageBase64 and docType are required" },
        { status: 400 }
      );
    }

    const prompt = DOC_PROMPTS[docType] ?? DOC_PROMPTS.other;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType ?? "image/jpeg",
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    const raw = response.text ?? "{}";
    // Strip markdown code fences
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const extracted: ExtractedDoc = JSON.parse(cleaned);
    return NextResponse.json({ success: true, data: extracted });
  } catch (err) {
    console.error("[scan/extract] error:", err);
    return NextResponse.json(
      { error: "Extraction failed. Please try a clearer image." },
      { status: 500 }
    );
  }
}
