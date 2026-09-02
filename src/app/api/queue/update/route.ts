// src/app/api/queue/update/route.ts
// Doctor updates patient status (call next, mark done, etc.)

import { NextRequest, NextResponse } from "next/server";
import { updatePatientStatus, getPatientByToken } from "@/lib/queue";
import type { QueuePatient } from "@/lib/queue";

export async function POST(req: NextRequest) {
  try {
    const { token, status }: { token: string; status: QueuePatient["status"] } = await req.json();

    if (!token || !status) {
      return NextResponse.json({ error: "token and status required" }, { status: 400 });
    }

    const validStatuses: QueuePatient["status"][] = ["waiting", "calling", "in_consultation", "done"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const success = updatePatientStatus(token, status);
    if (!success) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    const updated = getPatientByToken(token);
    return NextResponse.json({ success: true, patient: updated });
  } catch (err) {
    console.error("[queue/update]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
