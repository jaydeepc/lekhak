import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { SW } from "@/components/sw";

const nunito = Nunito({ subsets: ["latin", "latin-ext"], weight: ["400", "700", "800"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Lekhak · Piramal Investor Day", template: "%s · Lekhak" },
  description: "The keynote, every booth, and an AI note-taker you can ask anything — live.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/assets/icon-192.png", apple: "/assets/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Lekhak" },
};
export const viewport: Viewport = { themeColor: "#1D354A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body><ToastProvider>{children}</ToastProvider><SW /></body>
    </html>
  );
}
