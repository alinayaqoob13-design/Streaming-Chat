import type { Metadata } from "next";
import { Playfair_Display, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

// Display face for headings/title/tab labels — loaded once, exposed as a
// CSS variable consumed by --font-display in globals.css (@theme).
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

// Urdu artifact output deserves a proper Nastaliq face — the system serif
// fallback renders Urdu as disconnected blocky shapes that students in
// Pakistan immediately notice. Applied only on Urdu panels (--font-urdu).
const notoNastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-noto-nastaliq",
});

export const metadata: Metadata = {
  title: "AI Study Notes Buddy",
  description:
    "Paste lecture notes and get a summary, flashcards, and a quiz — powered by Google Gemini.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`min-h-screen bg-background ${playfair.variable} ${notoNastaliq.variable}`}
      >
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
