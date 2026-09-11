// src/app/api/queue/list/route.ts
// Doctor polling endpoint — Server-Sent Events for real-time push
// Falls back to regular JSON response for polling compatibility

import { NextRequest, NextResponse } from "next/server";
import { getQueueSnapshot, getQueueStats } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accept = req.headers.get("accept") ?? "";

  // ── SSE mode — doctor dashboard keeps connection open ─────────
  if (accept.includes("text/event-stream")) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial data
        const sendData = () => {
          const queue = getQueueSnapshot();
          const stats = getQueueStats();
          const active = queue
            .filter((p) => p.status !== "done")
            .sort((a, b) => a.tokenIndex - b.tokenIndex);
          const done = queue
            .filter((p) => p.status === "done")
            .sort((a, b) => b.tokenIndex - a.tokenIndex)
            .slice(0, 10);

          const payload = JSON.stringify({ stats, active, done, timestamp: Date.now() });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        };

        sendData();

        // Push every 2 seconds
        const interval = setInterval(sendData, 2000);

        // Keep alive ping every 30s
        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode(": ping\n\n"));
        }, 30000);

        // Cleanup on close
        req.signal.addEventListener("abort", () => {
          clearInterval(interval);
          clearInterval(keepAlive);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable Nginx buffering on Vercel
      },
    });
  }

  // ── Regular JSON fallback (for polling compatibility) ─────────
  const queue = getQueueSnapshot();
  const stats = getQueueStats();
  const active = queue
    .filter((p) => p.status !== "done")
    .sort((a, b) => a.tokenIndex - b.tokenIndex);
  const done = queue
    .filter((p) => p.status === "done")
    .sort((a, b) => b.tokenIndex - a.tokenIndex)
    .slice(0, 10);

  return NextResponse.json({ stats, active, done, timestamp: Date.now() });
}
