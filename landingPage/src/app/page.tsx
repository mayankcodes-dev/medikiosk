"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const APP_URL = "https://app.medikiosk.mayankcodes.dev";

const C = {
  white:  "#ffffff",
  black:  "#0d0d0d",
  blue:   "#2563eb",
  orange: "#f97316",
  gray:   "#f4f4f5",
  muted:  "#6b7280",
  border: "rgba(0,0,0,0.08)",
};
const FONT = "'Manrope', system-ui, sans-serif";

// ── Reveal wrapper ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "", style = {} }: {
  children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className} style={style}>
      {children}
    </motion.div>
  );
}

// ── Shared text styles ────────────────────────────────────────────────────────
const tagLabel = (color = C.blue): React.CSSProperties => ({
  fontFamily: FONT, fontSize: 11, fontWeight: 700,
  letterSpacing: "0.1em", textTransform: "uppercase" as const,
  color, marginBottom: 16, display: "block",
});

const h2: React.CSSProperties = {
  fontFamily: FONT, fontWeight: 800, letterSpacing: "-0.6px",
  lineHeight: 1.12, color: C.black, marginBottom: 20,
};

const bodyText: React.CSSProperties = {
  fontFamily: FONT, fontSize: 17, color: C.muted, lineHeight: 1.7, maxWidth: 440,
};

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  { tag: "Voice-first",  headline: "Talk to us.\nWe understand every language.",            body: "Speak in Hindi, Tamil, Bengali — or any of India's 22 Scheduled Languages. MediKiosk listens and understands. No typing needed.",                                                             img: "/feature-voice.png",    alt: "Patient speaking to MediKiosk" },
  { tag: "AI History",   headline: "Your doctor gets the full picture\nbefore you walk in.", body: "Our AI asks about your chief complaint, symptoms, duration, and past history — structuring everything into a clinical summary the doctor can act on.",                                          img: "/feature-ai.avif",      alt: "Doctor reviewing clinical summary" },
  { tag: "Documents",    headline: "Old prescriptions and reports —\njust scan them.",       body: "Upload a photo of your lab report, prescription, or discharge summary. MediKiosk reads it and adds key findings to your record automatically.",                                                 img: "/feature-docs.avif",    alt: "Scanning medical documents" },
  { tag: "Privacy",      headline: "Your data belongs to you.\nAlways.",                    body: "DPDP Act 2023 compliant. ABDM certified. No Aadhaar stored. Your record is shared only with your treating doctor, only on the day of your visit.",                                             img: "/feature-privacy.png",  alt: "Digital health privacy" },
];

const STEPS = [
  { n: "01", title: "Choose your language",     body: "Hindi, Tamil, Bengali, and 19 more." },
  { n: "02", title: "Speak your symptoms",      body: "Voice or touch — whatever feels natural." },
  { n: "03", title: "Upload old reports",       body: "Prescriptions, lab reports, discharge summaries." },
  { n: "04", title: "Doctor gets your summary", body: "Full clinical record ready before you enter." },
];

const LANGS = [
  { native: "हिंदी", en: "Hindi" },       { native: "தமிழ்", en: "Tamil" },
  { native: "తెలుగు", en: "Telugu" },     { native: "বাংলা", en: "Bengali" },
  { native: "मराठी", en: "Marathi" },     { native: "ગુજરાતી", en: "Gujarati" },
  { native: "ಕನ್ನಡ", en: "Kannada" },     { native: "മലയാളം", en: "Malayalam" },
  { native: "ਪੰਜਾਬੀ", en: "Punjabi" },    { native: "اردو", en: "Urdu" },
  { native: "ଓଡ଼ିଆ", en: "Odia" },        { native: "অসমীয়া", en: "Assamese" },
  { native: "मैथिली", en: "Maithili" },   { native: "डोगरी", en: "Dogri" },
  { native: "कोंकणी", en: "Konkani" },    { native: "नेपाली", en: "Nepali" },
  { native: "ᱥᱟᱱᱛᱟᱲᱤ", en: "Santali" }, { native: "سنڌي", en: "Sindhi" },
  { native: "संस्कृत", en: "Sanskrit" },  { native: "বোড়ো", en: "Bodo" },
  { native: "মণিপুরী", en: "Manipuri" },  { native: "کشمیری", en: "Kashmiri" },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const heroTextRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let lenis: import("lenis").default | null = null;
    async function init() {
      const { default: Lenis } = await import("lenis");
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      function raf(t: number) { lenis!.raf(t); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
    }
    init();
    return () => lenis?.destroy();
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    gsap.set(heroTextRef.current, { opacity: 0, y: 36 });
    gsap.to(heroTextRef.current, { opacity: 1, y: 0, duration: 1, delay: 0.25, ease: "power3.out" });
    return () => ScrollTrigger.killAll();
  }, []);

  return (
    <div style={{ background: C.white, color: C.black, fontFamily: FONT, overflowX: "hidden" }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div className="page-container" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <Image src="/logo.jpg" alt="MediKiosk" width={36} height={36} style={{ borderRadius: 10, objectFit: "cover" }} />
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px", color: C.black }}>
              Medi<span style={{ color: C.blue }}>Kiosk</span>
            </span>
          </a>

          {/* Nav links — desktop only */}
          <nav className="hide-mobile" style={{ display: "flex", gap: 32 }}>
            {["Features", "For Hospitals", "Languages"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(" ", "-")}`}
                style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: C.muted, textDecoration: "none" }}>
                {item}
              </a>
            ))}
          </nav>

          {/* CTA buttons — desktop */}
          <div className="hide-mobile" style={{ display: "flex", gap: 8 }}>
            <a href={APP_URL} className="btn-login">Log In ›</a>
            <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="btn-download">
              Get the App
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 16l-4-4h3V4h2v8h3l-4 4z"/><path d="M4 20h16"/>
              </svg>
            </a>
          </div>

          {/* Hamburger — mobile only */}
          <button
            className="show-mobile"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "none", flexDirection: "column", gap: 5, padding: 6,
            }}>
            <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? C.blue : C.black, transition: "0.2s", transform: menuOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
            <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? C.blue : C.black, transition: "0.2s", opacity: menuOpen ? 0 : 1 }} />
            <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? C.blue : C.black, transition: "0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div style={{
            position: "absolute", top: 64, left: 0, right: 0,
            background: C.white, borderBottom: `1px solid ${C.border}`,
            padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 16,
          }}>
            {["Features", "For Hospitals", "Languages"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(" ", "-")}`}
                onClick={() => setMenuOpen(false)}
                style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.black, textDecoration: "none" }}>
                {item}
              </a>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              <a href={APP_URL} className="btn-login" style={{ textAlign: "center" }}>Log In ›</a>
              <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="btn-download" style={{ textAlign: "center" }}>
                Get the App
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO — WhatsApp-style rounded card, one screen ──────────────────── */}
      <section style={{ paddingTop: 64, background: C.white }}>
        <div className="hero-container" style={{ paddingTop: 16, paddingBottom: 0 }}>
          {/* Rounded card — fits exactly one screen height */}
          <div style={{
            position: "relative",
            borderRadius: 18,
            overflow: "hidden",
            height: "calc(100vh - 64px - 16px)",
            minHeight: 420,
            maxHeight: 780,
            display: "flex",
            alignItems: "flex-end",
          }}>
            <Image
              src="/hero.jpg"
              alt="Patient at MediKiosk"
              fill
              priority
              style={{ objectFit: "cover", objectPosition: "center 20%" }}
            />
            {/* Gradient overlay */}
            <div className="hero-overlay" />

            {/* Text — bottom-left, WhatsApp style */}
            <div ref={heroTextRef} className="hero-text-wrap"
              style={{ position: "relative", zIndex: 2, padding: "48px 52px", maxWidth: 560 }}>
              <h1 style={{
                fontFamily: FONT, fontSize: "clamp(36px, 5.5vw, 66px)",
                fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1.08,
                color: C.white, marginBottom: 18,
              }}>
                Healthcare in<br />your language.
              </h1>
              <p style={{
                fontFamily: FONT, fontSize: "clamp(14px, 1.8vw, 17px)",
                color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 28, maxWidth: 380,
              }}>
                MediKiosk takes your full medical history — by voice, in your language — before you see the doctor.
              </p>
              <div className="btn-group" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href={APP_URL} className="btn-login btn-login-white">Log In ›</a>
                <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="btn-download">
                  Get the App
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 16l-4-4h3V4h2v8h3l-4 4z"/><path d="M4 20h16"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* AI chip — top right inside card */}
            <motion.div className="hero-chip-top"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "absolute", top: 32, right: 36, zIndex: 3,
                background: "rgba(255,255,255,0.96)", borderRadius: 18,
                padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, maxWidth: 250,
              }}>
              <Image src="/logo.jpg" alt="MediKiosk" width={40} height={40}
                style={{ borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: FONT, fontSize: 10, color: "#999", fontWeight: 600, marginBottom: 3 }}>MediKiosk AI</p>
                <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.black, lineHeight: 1.3 }}>
                  &ldquo;आपको क्या तकलीफ है?&rdquo;
                </p>
              </div>
            </motion.div>
          </div>
          {/* Footnote below card */}
          <p style={{ fontFamily: FONT, fontSize: 11, color: "#bbb", marginTop: 10, textAlign: "right" }}>
            * Free · No app store · Android · iOS · Desktop
          </p>
        </div>
      </section>




      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <section id="features" style={{ background: C.white }}>
        <div className="page-container" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <Reveal>
            <p style={tagLabel(C.blue)}>Simple process</p>
            <h2 style={{ ...h2, fontSize: "clamp(30px, 4vw, 48px)", maxWidth: 340, marginBottom: 56 }}>
              Four steps.<br />Under four minutes.
            </h2>
          </Reveal>
          <div className="four-col">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 0.1}>
                <p style={{ fontFamily: FONT, fontSize: 48, fontWeight: 800, color: "rgba(0,0,0,0.06)", lineHeight: 1, marginBottom: 16, letterSpacing: "-2px" }}>{step.n}</p>
                <p style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: C.black, marginBottom: 6 }}>{step.title}</p>
                <p style={{ fontFamily: FONT, fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{step.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      {FEATURES.map((feat, i) => {
        const isEven = i % 2 === 0;
        return (
          <section key={feat.tag} style={{ background: i % 2 === 0 ? C.gray : C.white }}>
            <div className="page-container two-col" style={{ paddingTop: 80, paddingBottom: 80 }}>
              <Reveal className={isEven ? "" : "order-flip"} style={{ order: isEven ? 1 : 2 }}>
                <p style={tagLabel(C.blue)}>{feat.tag}</p>
                <h2 style={{ ...h2, fontSize: "clamp(26px, 3vw, 38px)", whiteSpace: "pre-line" }}>{feat.headline}</h2>
                <p style={bodyText}>{feat.body}</p>
              </Reveal>
              <Reveal delay={0.12} style={{ order: isEven ? 2 : 1 }}>
                <div style={{ aspectRatio: "4/3", borderRadius: 20, overflow: "hidden", position: "relative", background: C.gray }}>
                  <Image src={feat.img} alt={feat.alt} fill style={{ objectFit: "cover" }} />
                </div>
              </Reveal>
            </div>
          </section>
        );
      })}

      {/* ── LANGUAGES ──────────────────────────────────────────────────────── */}
      <section id="languages" style={{ background: C.blue }}>
        <div className="page-container" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <Reveal>
            <p style={tagLabel("rgba(255,255,255,0.55)")}>Inclusive by design</p>
            <h2 style={{ ...h2, fontSize: "clamp(30px, 4vw, 48px)", color: C.white, maxWidth: 340, marginBottom: 44 }}>
              22 languages.<br />All of them.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {LANGS.map((lang) => (
                <div key={lang.en} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  borderRadius: 9999, padding: "8px 18px", cursor: "default",
                  transition: "border-color 0.2s ease, background 0.2s ease",
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#f97316";
                    (e.currentTarget as HTMLElement).style.background = "rgba(249,115,22,0.15)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.25)";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}>
                  <span style={{ fontSize: 15, color: C.white }}>{lang.native}</span>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{lang.en}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOR HOSPITALS ──────────────────────────────────────────────────── */}
      <section id="for-hospitals" style={{ background: C.white }}>
        <div className="page-container two-col" style={{ paddingTop: 96, paddingBottom: 96, alignItems: "stretch" }}>
          <Reveal>
            <p style={tagLabel(C.orange)}>For Hospitals</p>
            {/* Consistent large heading — each sentence locked to one line with nowrap */}
            <h2 style={{ ...h2, fontSize: "clamp(26px, 3vw, 40px)", maxWidth: 420, marginBottom: 36 }}>
              <span style={{ display: "block", whiteSpace: "nowrap" }}>Cut OPD wait times.</span>
              <span style={{ display: "block", whiteSpace: "nowrap" }}>Not quality of care.</span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                { icon: "⚡", title: "Faster OPD flow",  body: "Doctor gets a structured clinical summary before the patient enters." },
                { icon: "📊", title: "Doctor dashboard", body: "Annotate, approve, and print records from one clean screen." },
                { icon: "🔗", title: "ABDM / ABHA",      body: "Auto-push records to the patient's digital health locker." },
                { icon: "📵", title: "Offline-ready",    body: "Service worker keeps the kiosk running even when network drops." },
              ].map((item) => (
                <div key={item.title} style={{ display: "flex", gap: 14 }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.black, marginBottom: 3 }}>{item.title}</p>
                    <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Hospital image stretches full height */}
          <Reveal delay={0.12} style={{ display: "flex" }}>
            <div style={{ borderRadius: 20, overflow: "hidden", position: "relative", flex: 1, minHeight: 380 }}>
              <Image src="/hospital.jpg" alt="Hospital OPD" fill style={{ objectFit: "cover" }} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────────── */}
      <section style={{ background: C.gray, borderTop: `1px solid ${C.border}` }}>
        <div className="page-container" style={{ paddingTop: 96, paddingBottom: 96, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Reveal>
            <h2 style={{ fontFamily: FONT, fontSize: "clamp(34px, 5vw, 60px)", fontWeight: 800, letterSpacing: "-1.2px", lineHeight: 1.08, color: C.black, marginBottom: 14 }}>
              Ready to try MediKiosk?
            </h2>
            {/* Subtitle — 1 line on desktop, wraps naturally on mobile */}
            <p className="cta-subtitle" style={{ fontFamily: FONT, fontSize: 17, color: C.muted, lineHeight: 1.5, marginBottom: 36, whiteSpace: "nowrap" }}>
              Free. No app store needed. Works on any device.
            </p>
            <div className="btn-group" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <a href={APP_URL} className="btn-login btn-login-lg">Log In ›</a>
              <a href={`${APP_URL}?pwa=install`} target="_blank" rel="noopener noreferrer" className="btn-download btn-download-lg">
                Download
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 16l-4-4h3V4h2v8h3l-4 4z"/><path d="M4 20h16"/>
                </svg>
              </a>
            </div>
            <p style={{ fontFamily: FONT, fontSize: 12, color: "#bbb", marginTop: 18 }}>
              Android · iOS · Desktop · No app store required
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, background: C.white }}>
        <div className="page-container footer-bottom" style={{
          paddingTop: 22, paddingBottom: 26,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
        }}>
          {/* Left — logo + MediKiosk name */}
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <Image src="/logo.jpg" alt="MediKiosk" width={26} height={26} style={{ borderRadius: 7, objectFit: "cover" }} />
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: C.black }}>
              Medi<span style={{ color: C.blue }}>Kiosk</span>
            </span>
          </a>

          {/* Center — copyright */}
          <p style={{ fontFamily: FONT, fontSize: 13, color: "#aaa", fontWeight: 500, textAlign: "center", whiteSpace: "nowrap" }}>
            © 2026 MediKiosk · SIH 2026
          </p>

          {/* Right — team credit */}
          <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, color: "#aaa", textAlign: "right", whiteSpace: "nowrap" }}>
            Designed &amp; Developed by Team{" "}
            <span style={{ color: C.blue, fontWeight: 700 }}>वैद्य सहायक</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
