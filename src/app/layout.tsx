import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MediKiosk — AI Clinical History Platform",
  description:
    "AI-powered multilingual clinical history platform for Indian hospitals. PS 26047 | Ministry of AYUSH | SIH 2026",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MediKiosk",
  },
  keywords: [
    "MediKiosk",
    "ABHA",
    "ABDM",
    "clinical history",
    "AYUSH",
    "multilingual healthcare",
    "SIH 2026",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white antialiased">{children}</body>
    </html>
  );
}
