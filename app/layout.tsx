import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";

// Display face for headings/title/tab labels — loaded once, exposed as a
// CSS variable consumed by --font-display in globals.css (@theme).
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
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
      <body className={`min-h-screen bg-background ${playfair.variable}`}>
        {children}
      </body>
    </html>
  );
}
