import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Streaming Chat Capstone",
  description: "AI-powered streaming chat interface with Claude",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background">
        {children}
      </body>
    </html>
  );
}
