// src/app/api/auth/doctor/route.ts
// Server-side doctor PIN verification — PIN never exposed to client
// Read from DOCTOR_PIN env var, falls back to "1234" for dev only

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ── Simple constant-time string comparison to prevent timing attacks ──
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  // Use crypto.timingSafeEqual to prevent timing side-channels
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  try {
    const { pin }: { pin: string } = await req.json();

    if (!pin || typeof pin !== "string" || pin.length > 20) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const correctPin = process.env.DOCTOR_PIN ?? "1234";
    const isCorrect = safeCompare(pin.trim(), correctPin);

    if (!isCorrect) {
      // Artificial 500ms delay to rate-limit brute force
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    // Return a short-lived session token (not stored anywhere — stateless)
    const sessionToken = crypto
      .createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "dev-secret")
      .update(`doctor-${Date.now()}-${pin}`)
      .digest("hex");

    return NextResponse.json({
      success: true,
      sessionToken,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
    });
  } catch {
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
