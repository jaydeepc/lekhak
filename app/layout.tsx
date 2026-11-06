import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { SW } from "@/components/sw";

export const metadata: Metadata = {
  title: { default: "Lekhak · Piramal.ai", template: "%s · Lekhak" },
  description: "The keynote, every booth, and an AI note-taker you can ask anything — live.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/assets/icon-192.png?v=4", apple: "/assets/apple-touch-icon.png?v=4" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Lekhak" },
};
export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><ToastProvider>{children}</ToastProvider><SW /></body>
    </html>
  );
}
