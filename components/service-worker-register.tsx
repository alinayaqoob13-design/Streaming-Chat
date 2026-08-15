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

    // Dev: a service worker registered by a PAST production run (npm start,
    // or a Vercel visit on the same origin) keeps intercepting requests and
    // serving STALE cached chunks even in `npm run dev` — the classic "my
    // fix isn't showing up" trap. Actively unregister any leftover workers.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is an enhancement — swallow registration failures
    });
  }, []);

  return null;
}