/**
 * ============================================================================
 * SERVICE WORKER REGISTRATION
 * ============================================================================
 *
 * Tiny client component that registers public/sw.js once the page loads.
 * Production-only: the dev server must keep serving fresh assets so hot
 * reloads never fight a cache; once built, the shell caches itself.
 *
 * Verification is silent — a failed registration (private mode, unsupported
 * browser) must never break the app, it only loses offline support.
 * ============================================================================
 */

"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is an enhancement — swallow registration failures
    });
  }, []);

  return null;
}