"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  KioskHeader,
  KioskScreen,
  KioskBody,
  KioskFooter,
} from "@/components/kiosk/KioskLayout";
import { Button, Card, Divider } from "@/components/ui/primitives";
import { formatABHA } from "@/lib/utils";
import { t } from "@/lib/translations";

type LoginMethod = null | "abha" | "aadhaar" | "otp";
type OtpContext = "abha" | "aadhaar";

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState("hi");
  const [method, setMethod] = useState<LoginMethod>(null);
  const [otpContext, setOtpContext] = useState<OtpContext>("abha");
  const [abhaInput, setAbhaInput] = useState("");
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [txnId, setTxnId] = useState("");
  const [otpError, setOtpError] = useState("");
  const [devOtp, setDevOtp] = useState(""); // shown in dev mode only

  useEffect(() => {
    setLang(sessionStorage.getItem("mk_lang") ?? "hi");
  }, []);

  // ── Helpers ───────────────────────────────────────────────────
  function maskAadhaar(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 12);
    if (digits.length <= 4) return digits;
    if (digits.length <= 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  }

  async function handleSendOTP(context: OtpContext) {
    setLoading(true);
    setOtpContext(context);
    setOtpError("");
    try {
      const res = await fetch("/api/abdm/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_otp",
          aadhaarNumber: context === "aadhaar"
            ? aadhaarInput.replace(/\s/g, "")
            : abhaInput.replace(/-/g, ""),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTxnId(data.txnId);
        if (data.mockOtp) setDevOtp(data.mockOtp); // dev hint only
        setMethod("otp");
      } else {
        setOtpError(data.error ?? "Failed to send OTP");
      }
    } catch {
      setOtpError("Network error. Please try again.");
    }
    setLoading(false);
  }

  async function handleOTPVerify() {
    setLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/abdm/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_otp", txnId, otp: otpInput }),
      });
      const data = await res.json();
      if (!data.success) {
        setOtpError(data.error ?? "OTP incorrect");
        setLoading(false);
        return;
      }
      const profile = data.abhaProfile ?? {};
      sessionStorage.setItem(
        "mk_patient",
        JSON.stringify({
          abhaNumber: profile.ABHANumber ?? (otpContext === "abha" ? abhaInput.replace(/-/g, "") : undefined),
          aadhaarLinked: otpContext === "aadhaar",
          loginMethod: otpContext,
          name: profile.name ?? "Verified Patient",
          gender: profile.gender === "M" ? "male" : profile.gender === "F" ? "female" : "other",
          yearOfBirth: profile.yearOfBirth ?? 1980,
        })
      );
      setLoading(false);
      router.push("/consent");
    } catch {
      setOtpError("Verification failed. Please try again.");
      setLoading(false);
    }
  }

  function handleGuest() {
    sessionStorage.setItem("mk_patient", JSON.stringify({ name: "Guest", loginMethod: "anonymous" }));
    router.push("/consent");
  }


  // ── OTP Screen ─────────────────────────────────────────────────
  if (method === "otp") {
    return (
      <KioskScreen>
        <KioskHeader
          title={t(lang, "enterOTP")}
          subtitle="Enter OTP"
          onBack={() => { setMethod(otpContext as LoginMethod); setOtpInput(""); }}
          progress={15}
          stepLabel="1 / 6"
        />
        <KioskBody className="flex flex-col items-center gap-6 justify-center py-10">
          <div className="text-center space-y-1">
            <p className="text-5xl">📱</p>
            <h2 className="text-xl font-bold text-neutral-900">
              {t(lang, "otpSentMessage")}
            </h2>
            <p className="text-sm text-neutral-400">OTP sent to your registered mobile</p>
          </div>

          {/* Identifier hint */}
          <div className="bg-neutral-50 rounded-xl px-5 py-2.5 text-sm text-neutral-500 text-center">
            {otpContext === "abha"
              ? `ABHA: ${formatABHA(abhaInput)}`
              : `Aadhaar: XXXX XXXX ${aadhaarInput.replace(/\D/g, "").slice(-4)}`}
          </div>

          {/* OTP Input */}
          <input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            placeholder="— — — — — —"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={`w-48 text-center text-3xl tracking-[0.4em] font-bold
                       border-2 rounded-2xl py-4
                       focus:outline-none transition-colors
                       ${otpError ? "border-red-400 bg-red-50" : "border-neutral-300 focus:border-brand-500"}`}
            autoFocus
          />

          {/* Error message */}
          {otpError && (
            <p className="text-sm text-red-600 font-semibold text-center bg-red-50
                           border border-red-200 rounded-xl px-4 py-2 w-full max-w-xs">
              ⚠️ {otpError}
            </p>
          )}

          {/* Dev mode OTP hint */}
          {devOtp && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-center w-full max-w-xs">
              <p className="text-xs text-amber-600 font-bold uppercase tracking-wide">🧪 Dev Mode — OTP</p>
              <p className="text-2xl font-black text-amber-800 tracking-widest">{devOtp}</p>
              <p className="text-xs text-amber-500">This hint is hidden in production</p>
            </div>
          )}

          <Button
            variant="primary"
            size="xl"
            fullWidth
            className="max-w-xs"
            loading={loading}
            disabled={otpInput.length < 4}
            onClick={handleOTPVerify}
          >
            {t(lang, "verifyAndContinue")}
          </Button>

          <button
            className="text-brand-600 text-sm font-semibold hover:underline"
            onClick={() => handleSendOTP(otpContext)}
          >
            🔁 {t(lang, "resendOTP")}
          </button>
        </KioskBody>
      </KioskScreen>
    );
  }


  // ── ABHA Number Input ──────────────────────────────────────────
  if (method === "abha") {
    return (
      <KioskScreen>
        <KioskHeader
          title={t(lang, "enterABHANumber")}
          subtitle="Enter ABHA Number"
          onBack={() => setMethod(null)}
          progress={10}
          stepLabel="1 / 6"
        />
        <KioskBody className="flex flex-col items-center gap-6 justify-center py-10">
          <p className="text-6xl text-center">🪪</p>
          <div className="w-full max-w-sm space-y-3">
            <p className="text-sm text-neutral-500 text-center">
              {t(lang, "loginWithABHADesc")}
            </p>
            <p className="text-xs text-neutral-400 text-center">
              Format: 91-XXXX-XXXX-XXXX
            </p>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="91-XXXX-XXXX-XXXX"
              value={formatABHA(abhaInput)}
              onChange={(e) =>
                setAbhaInput(e.target.value.replace(/\D/g, "").slice(0, 14))
              }
              className="w-full text-center text-xl tracking-widest font-bold
                         border-2 border-neutral-300 rounded-2xl py-4 px-4
                         focus:border-brand-500 focus:outline-none transition-colors"
              autoFocus
            />
          </div>
          <Button
            variant="primary"
            size="xl"
            fullWidth
            className="max-w-sm"
            loading={loading}
            disabled={abhaInput.replace(/\D/g, "").length < 14}
            onClick={() => handleSendOTP("abha")}
          >
            📲 &nbsp;{t(lang, "sendOTP")}
          </Button>
        </KioskBody>
      </KioskScreen>
    );
  }

  // ── Aadhaar Number Input ───────────────────────────────────────
  if (method === "aadhaar") {
    return (
      <KioskScreen>
        <KioskHeader
          title={t(lang, "enterAadhaarNumber")}
          subtitle="Enter Aadhaar Number"
          onBack={() => setMethod(null)}
          progress={10}
          stepLabel="1 / 6"
        />
        <KioskBody className="flex flex-col items-center gap-6 justify-center py-10">
          <p className="text-6xl text-center">🪪</p>
          <div className="w-full max-w-sm space-y-3">
            <p className="text-sm text-neutral-500 text-center">
              {t(lang, "loginWithAadhaarDesc")}
            </p>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="XXXX XXXX XXXX"
              value={maskAadhaar(aadhaarInput)}
              onChange={(e) =>
                setAadhaarInput(e.target.value.replace(/\D/g, "").slice(0, 12))
              }
              className="w-full text-center text-xl tracking-[0.3em] font-bold
                         border-2 border-neutral-300 rounded-2xl py-4 px-4
                         focus:border-secondary-500 focus:outline-none transition-colors"
              autoFocus
            />
            <p className="text-xs text-neutral-400 text-center">
              🔒 {t(lang, "aadhaarNeverStored")}
            </p>
          </div>
          <Button
            variant="primary"
            size="xl"
            fullWidth
            className="max-w-sm"
            loading={loading}
            disabled={aadhaarInput.replace(/\D/g, "").length < 12}
            onClick={() => handleSendOTP("aadhaar")}
          >
            📲 &nbsp;{t(lang, "sendOTP")}
          </Button>
        </KioskBody>
      </KioskScreen>
    );
  }

  // ── Default: Method Selection ──────────────────────────────────
  return (
    <KioskScreen>
      <KioskHeader
        title={t(lang, "identifyYourself")}
        subtitle="Identify Yourself"
        onBack={() => router.push("/")}
        progress={5}
        stepLabel="1 / 6"
      />

      <KioskBody className="space-y-4">
        {/* Logo top */}
        <div className="flex justify-center mb-2">
          <Image src="/logo.jpg" alt="MediKiosk" width={52} height={52}
            className="rounded-full border border-brand-100" />
        </div>

        {/* ── TWO PRIMARY options (big cards) ── */}
        <div className="grid grid-cols-1 gap-3">
          {/* ABHA Login */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <button
              onClick={() => setMethod("abha")}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2
                         border-brand-200 bg-brand-50 hover:bg-brand-100 hover:border-brand-400
                         active:scale-[0.98] transition-all duration-150 text-left"
            >
              <div className="h-14 w-14 rounded-2xl bg-brand-600 flex items-center
                              justify-center text-white text-2xl shrink-0 shadow-sm">
                🪪
              </div>
              <div className="flex-1">
                <p className="font-bold text-brand-900 text-lg leading-tight">
                  {t(lang, "loginWithABHA")}
                </p>
                <p className="text-sm text-brand-700 font-medium mt-0.5">Login with ABHA ID</p>
                <p className="text-xs text-neutral-400 mt-1">{t(lang, "loginWithABHADesc")}</p>
              </div>
              <svg className="text-brand-400 shrink-0" width="20" height="20"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </motion.div>

          {/* Aadhaar Login */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <button
              onClick={() => setMethod("aadhaar")}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2
                         border-secondary-200 bg-secondary-50 hover:bg-secondary-100
                         hover:border-secondary-400 active:scale-[0.98] transition-all
                         duration-150 text-left"
            >
              <div className="h-14 w-14 rounded-2xl bg-secondary-500 flex items-center
                              justify-center text-white text-2xl shrink-0 shadow-sm">
                🪪
              </div>
              <div className="flex-1">
                <p className="font-bold text-secondary-900 text-lg leading-tight">
                  {t(lang, "loginWithAadhaar")}
                </p>
                <p className="text-sm text-secondary-700 font-medium mt-0.5">Login with Aadhaar</p>
                <p className="text-xs text-neutral-400 mt-1">{t(lang, "loginWithAadhaarDesc")}</p>
              </div>
              <svg className="text-secondary-400 shrink-0" width="20" height="20"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </motion.div>
        </div>

        <Divider />

        {/* ── TWO SECONDARY options (smaller) ── */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Create ABHA — external link */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
          >
            <a
              href="https://abha.abdm.gov.in/abha/v3/register"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-neutral-200
                         bg-white hover:bg-neutral-50 hover:border-neutral-300 active:scale-95
                         transition-all text-center w-full"
            >
              <span className="text-xl">✨</span>
              <p className="font-semibold text-neutral-700 text-sm leading-tight">
                {t(lang, "createABHA")}
              </p>
              <p className="text-xs text-neutral-400">Create New ABHA</p>
            </a>
          </motion.div>

          {/* Continue without ABHA */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
          >
            <button
              onClick={handleGuest}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-neutral-200
                         bg-white hover:bg-neutral-50 hover:border-neutral-300 active:scale-95
                         transition-all text-center w-full"
            >
              <span className="text-xl">👤</span>
              <p className="font-semibold text-neutral-700 text-sm leading-tight">
                {t(lang, "continueWithoutABHA")}
              </p>
              <p className="text-xs text-neutral-400">Skip ABHA login</p>
            </button>
          </motion.div>
        </div>

        {/* Privacy note */}
        <p className="text-xs text-neutral-400 text-center pt-1">
          🔒 {t(lang, "aadhaarNeverStored")}
          <br />Your Aadhaar is never stored — we use ABHA only.
        </p>
      </KioskBody>
    </KioskScreen>
  );
}
