import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip type errors during `next build` in Phase 0.
  // Run `npm run typecheck` separately for strict checking.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Skip ESLint errors during build (run `npm run lint` separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [],
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=self, microphone=self, geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
