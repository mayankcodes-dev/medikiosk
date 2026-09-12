# MediKiosk — Implementation Audit
Updated: 2026-09-12 | Build: 793c6f3

## Status Legend
- WORKS — working end-to-end
- PARTIAL — works with caveats
- FIXED — was broken, fixed this session
- BROKEN — still needs work

---

## Patient Flow (Critical Path)

| Screen | Status | Notes |
|--------|--------|-------|
| / Language selector | WORKS | 22 langs, grid, show-all |
| /login Mobile/ABHA/Aadhaar | PARTIAL | 0000 bypass works; Twilio DLT-restricted in prod |
| /consent Audio-guided | WORKS | Real Bhashini TTS, 11-language spoken consent |
| /history AI interview (14 stages) | WORKS | Adaptive Gemini AI, mic with clear error banners |
| /scan Document upload + OCR | WORKS | Gemini Vision, 100MB limit, multiple docs |
| /summary Patient report | WORKS | Builds from real Q&A, AYUSH section renders |
| /complete Token + queue | WORKS | Queue now persisted to Neon DB |
| /doctor Dashboard | WORKS | Reads from Neon DB queue — survives cold starts |

---

## Fixes Applied This Session (commit 793c6f3)

| Fix | Impact |
|-----|--------|
| **Mobile OTP → Neon DB** (`otp_sessions` table) | CRITICAL — OTP verify was failing in prod on cold starts; in-memory global never survives Cloudflare Worker restart |
| `otp_sessions` DB migration run on Neon | Required for above |
| **AYUSH summary fields for `combined` mode** | CRITICAL — AYUSH Prakriti/Vikriti/Agni etc. were missing from generated report because `buildSummaryPrompt` only checked `mode === "ayush"`, but the app always sends `"combined"` |
| **OTP screen title/subtitle i18n** (`login/page.tsx`) | Was hardcoded `"OTP दर्ज करें"` (Hindi) regardless of language |
| **History complete screen i18n** (`history/page.tsx`) | Was hardcoded `"इतिहास पूरा हुआ"` (Hindi) |
| **Scan page doc prompt i18n** (`scan/page.tsx`) | Was hardcoded Hindi `"क्या आपके पास..."` |
| **`doYouHaveDocs` + `historyComplete` translation keys** | Added to hi, en, bn, ta, te, mr, gu, kn, ml, pa, ur |
| **localhost:3000 → production URL** (`abdm/scan-share/route.ts`) | Callback URL was localhost in prod |
| JSX apostrophe escape in `complete/page.tsx` | Minor but caused lint warning |

---

## Fixes Applied Previous Session (commit 724e110)

| Fix | Impact |
|-----|--------|
| Queue routes rewritten to use Neon DB | CRITICAL — doctor dashboard was empty in prod |
| queue_entries table created in Neon | Required for above |
| gemini-2.0-flash removed from scan/extract | Was causing 404 on every doc scan |
| metadataBase added to layout.tsx | OG images now resolve correctly in prod |
| prefers-reduced-motion CSS | Accessibility — all animations respect user setting |
| Micro-interaction CSS utilities | hover-lift, press-scale, shimmer, success-flash, fade-up |

---

## Previous Session Fixes (commit 7047829)

| Fix | Impact |
|-----|--------|
| Adaptive AI userPrompt | Questions build on actual patient answers |
| usePageSpeaker hook | Real Bhashini TTS on consent page |
| Report uses real Q&A data | buildSummaryFromMessages() + fallback |
| isAyush fix for combined mode | AYUSH section now always shows |
| Gemini 429 retry (6s backoff) | Handles rate limit gracefully |
| Mic error clear banners | NotAllowedError / NotFoundError / NotReadableError |

---

## Production Environment

### Cloudflare Pages — MISSING Variables (CRITICAL)
Add at: Cloudflare Dashboard → Pages → medikiosk-app → Settings → Environment Variables

- BHASHINI_API_KEY — TTS/ASR broken without this
- BHASHINI_USER_ID — same
- NEXT_PUBLIC_APP_URL = https://app.medikiosk.mayankcodes.dev

See .ai/CLOUDFLARE_ENV.md for full list.

---

## Known Remaining Issues

| Issue | Priority | Status |
|-------|----------|--------|
| Bhashini env vars not in Cloudflare | P0 | Manual step for user |
| Twilio DLT restriction on mobile OTP | P1 | devOtp fallback works |
| ABHA is sandbox only (no real ABDM creds) | P2 | Intended for demo |
| RAG ingest/query not wired to UI | P3 | Routes exist, not used in flow |
