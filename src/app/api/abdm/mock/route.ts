// src/app/api/abdm/mock/route.ts
// ABDM Mock — simulates Aadhaar OTP and ABHA verification flow
// Used when ABDM_CLIENT_ID is empty (no sandbox credentials yet)
// When real credentials arrive → replace mock calls with real ABDM API
// No changes to UI needed — same response shape

import { NextRequest, NextResponse } from "next/server";

// ── Simulated OTP store (in-memory, 5 minute TTL) ─────────────────
declare global {
  // eslint-disable-next-line no-var
  var __mockOTPStore: Map<string, { otp: string; expiresAt: number }> | undefined;
}
function getOTPStore() {
  if (!global.__mockOTPStore) global.__mockOTPStore = new Map();
  return global.__mockOTPStore;
}

function randomOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  const { action, aadhaarNumber, otp, txnId } = await req.json();

  // ── If real ABDM credentials exist → proxy to real API ────────
  if (process.env.ABDM_CLIENT_ID) {
    // TODO: implement real ABDM calls when credentials arrive
    // Placeholder: fall through to mock for now
  }

  // ── MOCK FLOW ─────────────────────────────────────────────────

  // Step 1: Send OTP to Aadhaar
  if (action === "send_otp") {
    if (!aadhaarNumber || aadhaarNumber.replace(/\s/g, "").length !== 12) {
      return NextResponse.json({ error: "Invalid Aadhaar number" }, { status: 400 });
    }

    const store = getOTPStore();
    const mockOtp = randomOTP();
    const txnIdGenerated = `TXN-${Date.now()}-MOCK`;

    // Store OTP (5 min TTL)
    store.set(txnIdGenerated, {
      otp: mockOtp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    console.log(`[ABDM Mock] OTP for ${aadhaarNumber}: ${mockOtp} (txn: ${txnIdGenerated})`);

    return NextResponse.json({
      success: true,
      txnId: txnIdGenerated,
      message: "OTP sent to mobile linked with Aadhaar",
      // In mock mode — expose OTP in response for testing
      // In production — this field is absent
      ...(process.env.NODE_ENV !== "production" && { mockOtp }),
    });
  }

  // Step 2: Verify OTP → return ABHA profile
  if (action === "verify_otp") {
    if (!txnId || !otp) {
      return NextResponse.json({ error: "txnId and otp required" }, { status: 400 });
    }

    const store = getOTPStore();
    const entry = store.get(txnId);

    if (!entry) {
      return NextResponse.json({ error: "Transaction expired. Please resend OTP." }, { status: 410 });
    }

    if (Date.now() > entry.expiresAt) {
      store.delete(txnId);
      return NextResponse.json({ error: "OTP expired. Please resend." }, { status: 410 });
    }

    // In mock mode → any 6-digit OTP works (or match exact)
    const isMock = !process.env.ABDM_CLIENT_ID;
    if (!isMock && entry.otp !== otp) {
      return NextResponse.json({ error: "Incorrect OTP" }, { status: 401 });
    }

    store.delete(txnId);

    // Return mock ABHA profile
    return NextResponse.json({
      success: true,
      abhaProfile: {
        ABHANumber: `14-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
        name: "Patient (Verified)",
        gender: "M",
        yearOfBirth: "1985",
        mobile: "XXXXXXXX89",
        email: "",
        verificationStatus: "VERIFIED",
        kycVerified: true,
      },
      authToken: `mock-auth-${Date.now()}`,
      isMockMode: isMock,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
