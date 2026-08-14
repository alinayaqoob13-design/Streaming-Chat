/** ============================================================================
 * WEB APP MANIFEST — installable PWA
 * ============================================================================
 * Next.js 15 App Router serves this as /manifest.webmanifest automatically.
 * Together with public/sw.js this makes the Notes Buddy installable on
 * desktop/mobile ("Add to Home Screen") and offline-capable after first load.
 * ============================================================================ */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Study Notes Buddy",
    short_name: "Notes Buddy",
    description:
      "Paste lecture notes and get a summary, flashcards, and a quiz — powered by Google Gemini.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e0b0d",
    theme_color: "#0e0b0d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // Same art, purpose maskable: the glyph sits inside the safe circle so
      // platform mask shapes never crop it.
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}