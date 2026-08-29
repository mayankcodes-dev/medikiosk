"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PRIMARY_LANGUAGES, type Language } from "@/lib/constants";
import { MediKioskLogo } from "@/components/kiosk/KioskLayout";
import { Badge } from "@/components/ui/primitives";

export default function LanguageSelectionPage() {
  const router = useRouter();

  function handleSelect(lang: Language) {
    // Store chosen language in sessionStorage
    sessionStorage.setItem("mk_lang", lang.code);
    sessionStorage.setItem("mk_lang_name", lang.nameEn);
    router.push("/login");
  }

  return (
    <main className="min-h-dvh bg-white flex flex-col">
      {/* ── Top strip ── */}
      <div className="bg-brand-600 text-white text-center py-2 text-sm font-medium tracking-wide">
        🇮🇳 &nbsp;SIH 2026 — PS 26047 — Ministry of AYUSH
      </div>

      {/* ── Hero ── */}
      <div className="flex flex-col items-center pt-10 pb-6 px-6">
        <MediKioskLogo size="lg" />
        <p className="mt-3 text-neutral-500 text-base text-center max-w-sm">
          AI-Powered Clinical History Platform
        </p>
        <Badge variant="info" className="mt-3">
          🔒 ABDM Certified &nbsp;·&nbsp; DPDP Compliant
        </Badge>
      </div>

      {/* ── Language prompt ── */}
      <div className="text-center px-6 mb-6">
        <h2 className="text-2xl font-bold text-neutral-900">
          अपनी भाषा चुनें
        </h2>
        <p className="text-neutral-500 mt-1">Choose Your Language</p>
      </div>

      {/* ── Language Grid ── */}
      <div className="flex-1 px-6 pb-8 max-w-2xl w-full mx-auto">
        <div className="grid grid-cols-3 gap-3">
          {PRIMARY_LANGUAGES.map((lang, idx) => (
            <motion.button
              key={lang.code}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => handleSelect(lang)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5",
                "rounded-2xl border-2 border-neutral-200 bg-white p-4",
                "min-h-[88px] cursor-pointer select-none",
                "hover:border-brand-400 hover:bg-brand-50 hover:shadow-md",
                "active:scale-95 transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              )}
              dir={lang.rtl ? "rtl" : "ltr"}
            >
              {/* Native script name */}
              <span
                className={cn(
                  "font-bold text-neutral-900 leading-tight",
                  lang.code === "en" ? "text-lg" : "text-xl"
                )}
              >
                {lang.name}
              </span>
              {/* English sub-label */}
              <span className="text-xs text-neutral-400 font-medium">
                {lang.nameEn}
              </span>
            </motion.button>
          ))}
        </div>

        {/* More languages link */}
        <button
          onClick={() => {
            /* TODO Phase 2: show all 22 languages modal */
          }}
          className="w-full mt-4 py-3 text-brand-600 font-semibold text-sm
                     hover:text-brand-800 transition-colors"
        >
          + More languages / अन्य भाषाएं
        </button>
      </div>

      {/* ── Footer trust bar ── */}
      <div className="border-t border-neutral-100 py-4 px-6 flex items-center justify-center gap-6 text-xs text-neutral-400">
        <span>🏛️ Govt. of India</span>
        <span>🤝 ABDM Partner</span>
        <span>🔐 Your data is safe</span>
      </div>
    </main>
  );
}
