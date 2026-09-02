import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MediKiosk — AI Clinical History Kiosk",
  description:
    "AI-powered multilingual clinical history-taking kiosk for Indian hospitals and AYUSH clinics. Speaks 13 Indian languages. PS 26047 | Ministry of AYUSH | SIH 2026",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MediKiosk",
  },
  keywords: [
    "MediKiosk", "ABHA", "ABDM", "clinical history",
    "AYUSH", "multilingual healthcare", "SIH 2026",
    "Bhashini", "voice kiosk",
  ],
  openGraph: {
    title: "MediKiosk — AI Clinical History Kiosk",
    description: "AI voice agent takes patient history in 13 Indian languages before doctor consultation.",
    url: "https://medikiosk.mayankcodes.dev",
    siteName: "MediKiosk",
    type: "website",
  },
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
    <html lang="hi" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/logo.jpg" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-white antialiased">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
