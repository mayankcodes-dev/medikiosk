"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { KioskHeader, KioskScreen, KioskBody, KioskFooter } from "@/components/kiosk/KioskLayout";
import { Button, Card, Divider } from "@/components/ui/primitives";
import { formatABHA } from "@/lib/utils";

type LoginMethod = null | "abha" | "aadhaar" | "new" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<LoginMethod>(null);
  const [abhaInput, setAbhaInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [txnId, setTxnId] = useState<string | null>(null);

  // ── Mock auth flow for Phase 0 ───────────────────────────────
  async function handleABHASubmit() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200)); // simulate API
    setTxnId("mock-txn-" + Date.now());
    setMethod("otp");
    setLoading(false);
  }

  async function handleOTPVerify() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    // Store mock patient in sessionStorage
    sessionStorage.setItem(
      "mk_patient",
      JSON.stringify({
        abhaNumber: abhaInput.replace(/-/g, ""),
        name: "Ramesh Kumar",
        gender: "male",
        yearOfBirth: 1978,
      })
    );
    setLoading(false);
    router.push("/consent");
  }

  function handleGuestContinue() {
    sessionStorage.setItem("mk_patient", JSON.stringify({ name: "Guest" }));
    router.push("/consent");
  }

  // ── Login option cards ────────────────────────────────────────
  const loginOptions = [
    {
      id: "abha",
      icon: "🪪",
      title: "ABHA ID से लॉगिन",
      titleEn: "Login with ABHA ID",
      description: "14-digit health account number",
    },
    {
      id: "qr",
      icon: "📷",
      title: "QR कोड स्कैन करें",
      titleEn: "Scan QR Code",
      description: "Use ABHA app to scan",
    },
    {
      id: "new",
      icon: "✨",
      title: "नया ABHA बनाएं",
      titleEn: "Create New ABHA",
      description: "Register with Aadhaar",
    },
    {
      id: "guest",
      icon: "👤",
      title: "बिना ABHA के जारी रखें",
      titleEn: "Continue without ABHA",
      description: "Record won't be saved to health account",
    },
  ] as const;

  // ── Render OTP screen ─────────────────────────────────────────
  if (method === "otp") {
    return (
      <KioskScreen>
        <KioskHeader
          title="OTP दर्ज करें"
          subtitle="Enter the OTP sent to your registered mobile"
          onBack={() => { setMethod(null); setTxnId(null); }}
          progress={15}
          stepLabel="Step 1 of 6"
        />
        <KioskBody className="flex flex-col gap-6 justify-center items-center py-12">
          <div className="text-center space-y-2">
            <p className="text-5xl">📱</p>
            <h2 className="text-xl font-bold text-neutral-900">
              OTP आपके मोबाइल पर भेजा गया है
            </h2>
            <p className="text-neutral-500 text-sm">
              OTP sent to your ABHA-registered mobile
            </p>
          </div>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit OTP"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full max-w-xs text-center text-3xl tracking-[0.5em] font-bold
                       border-2 border-neutral-300 rounded-2xl py-4 focus:border-brand-500
                       focus:outline-none transition-colors"
            autoFocus
          />
          <Button
            variant="primary"
            size="xl"
            fullWidth
            className="max-w-xs"
            loading={loading}
            disabled={otpInput.length < 4}
            onClick={handleOTPVerify}
          >
            ✅ &nbsp;Verify &amp; Continue
          </Button>
          <button className="text-brand-600 text-sm font-semibold hover:underline">
            🔁 Resend OTP / OTP दोबारा भेजें
          </button>
        </KioskBody>
      </KioskScreen>
    );
  }

  // ── Render ABHA number input ───────────────────────────────────
  if (method === "abha") {
    return (
      <KioskScreen>
        <KioskHeader
          title="ABHA ID दर्ज करें"
          subtitle="Enter your 14-digit ABHA number"
          onBack={() => setMethod(null)}
          progress={10}
          stepLabel="Step 1 of 6"
        />
        <KioskBody className="flex flex-col gap-6 justify-center items-center py-12">
          <p className="text-6xl text-center">🪪</p>
          <div className="w-full max-w-sm space-y-4">
            <label className="block text-neutral-700 font-semibold text-center mb-1">
              ABHA Number (91-XXXX-XXXX-XXXX)
            </label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="91-XXXX-XXXX-XXXX"
              value={formatABHA(abhaInput)}
              onChange={(e) =>
                setAbhaInput(e.target.value.replace(/\D/g, "").slice(0, 14))
              }
              className="w-full text-center text-2xl tracking-widest font-bold
                         border-2 border-neutral-300 rounded-2xl py-4 px-4
                         focus:border-brand-500 focus:outline-none transition-colors"
              autoFocus
            />
            <p className="text-xs text-neutral-400 text-center">
              आपका ABHA नंबर आपके ABHA कार्ड पर है
            </p>
          </div>
          <Button
            variant="primary"
            size="xl"
            fullWidth
            className="max-w-sm"
            loading={loading}
            disabled={abhaInput.replace(/\D/g, "").length < 14}
            onClick={handleABHASubmit}
          >
            📲 &nbsp;Send OTP
          </Button>
        </KioskBody>
      </KioskScreen>
    );
  }

  // ── Default: Method selection screen ─────────────────────────
  return (
    <KioskScreen>
      <KioskHeader
        title="अपनी पहचान बताएं"
        subtitle="Identify Yourself"
        onBack={() => router.push("/")}
        progress={5}
        stepLabel="Step 1 of 6"
      />
      <KioskBody>
        <div className="space-y-3 pt-2">
          {loginOptions.map((opt, i) => (
            <motion.div
              key={opt.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <Card
                interactive
                className="p-5"
                onClick={() => {
                  if (opt.id === "abha") setMethod("abha");
                  else if (opt.id === "guest") handleGuestContinue();
                  /* QR + new ABHA: Phase 1 integration */
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && (
                  opt.id === "abha" ? setMethod("abha")
                  : opt.id === "guest" ? handleGuestContinue()
                  : undefined
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-900 text-lg leading-tight">
                      {opt.title}
                    </p>
                    <p className="text-sm text-neutral-500 leading-tight mt-0.5">
                      {opt.titleEn}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {opt.description}
                    </p>
                  </div>
                  <svg
                    className="text-neutral-400 shrink-0"
                    width="20" height="20" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <Divider />

        <p className="text-xs text-neutral-400 text-center px-4">
          🔒 आपका Aadhaar नंबर कभी स्टोर नहीं किया जाता।
          Your Aadhaar is never stored — we only use ABHA.
        </p>
      </KioskBody>
    </KioskScreen>
  );
}
