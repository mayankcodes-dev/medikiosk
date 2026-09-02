// src/app/api/queue/list/route.ts
// Returns current queue snapshot for doctor's dashboard polling
// Doctor's UI polls this every 3 seconds

import { NextResponse } from "next/server";
import { getQueueSnapshot, getQueueStats } from "@/lib/queue";

export const dynamic = "force-dynamic"; // never cache

export async function GET() {
  const queue = getQueueSnapshot();
  const stats = getQueueStats();

  // Send active patients (waiting + calling + in_consultation), most recent first
  const active = queue
    .filter((p) => p.status !== "done")
    .sort((a, b) => a.tokenIndex - b.tokenIndex);

  const done = queue
    .filter((p) => p.status === "done")
    .sort((a, b) => b.tokenIndex - a.tokenIndex)
    .slice(0, 10); // last 10 done

  return NextResponse.json({ stats, active, done, timestamp: Date.now() });
}
