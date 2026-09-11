// src/app/api/queue/add/route.ts
// Add a patient to the live token queue after history + docs are done

import { NextRequest, NextResponse } from "next/server";
import { addToQueue, getWaitingCount } from "@/lib/queue";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const patient = addToQueue({
      lang: body.lang ?? "hi",
      loginMethod: body.loginMethod ?? "anonymous",
      patientName: body.patientName,
      chiefComplaint: body.chiefComplaint ?? "Not specified",
      severity: body.severity ?? "moderate",
      suggestedICD10: body.suggestedICD10 ?? "",
      redFlags: body.redFlags ?? [],
      ayushNote: body.ayushNote,
      hasDocuments: body.hasDocuments ?? false,
    });

    const waitingAhead = getWaitingCount() - 1; // exclude this patient
    const estimatedWaitMins = Math.max(0, waitingAhead * 3); // ~3 min per patient

    return NextResponse.json({
      success: true,
      token: patient.token,
      tokenIndex: patient.tokenIndex,
      position: waitingAhead + 1,
      estimatedWaitMins,
      submittedAt: patient.submittedAt,
    });
  } catch (err) {
    console.error("[queue/add]", err);
    return NextResponse.json({ error: "Failed to add to queue" }, { status: 500 });
  }
}
