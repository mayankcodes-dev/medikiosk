// src/middleware.ts
// Edge middleware — rate limiting on API routes + security headers

import { NextRequest, NextResponse } from "next/server";

// ── In-memory rate limit store (per IP, per minute) ───────────────
// Edge runtime uses a shared Map — good enough for single-region demos
// Production: use Vercel KV for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; reset: number }>();
const RPM = parseInt(process.env.RATE_LIMIT_RPM ?? "60", 10);

function getRateLimitKey(req: NextRequest): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return `rl:${ip}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(key, { count: 1, reset: now + windowMs });
    return false;
  }

  entry.count += 1;
  if (entry.count > RPM) return true;

  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Security headers on all responses ────────────────────────
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(self)");

  // ── Rate limit only API routes ────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const key = getRateLimitKey(req);
    if (isRateLimited(key)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429 }
      );
    }
  }

  return res;
}

export const config = {
  matcher: [
    // API routes
    "/api/:path*",
    // All pages except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|logo.jpg|manifest.json|sw.js).*)",
  ],
};
