"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { Menu, PenLine, PanelLeftClose, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedStudySet } from "@/types/notes";

// sessionStorage key — the collapsed rail survives same-tab refreshes but
// resets in a genuinely new session (per the phase brief, not permanent).
const COLLAPSED_KEY = "capstone-sidebar-collapsed";

// ---------------------------------------------------------------------------
// LIST STAGGER VARIANTS — recent-set rows fade up one after another (40ms
// apart). Module-level (not recreated per render) so framer-motion can track
// enter/exit without remount churn.
// ---------------------------------------------------------------------------
const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
};

export interface AppShellProps {
  children: React.ReactNode;
  savedSets: SavedStudySet[];
  activeSetId: string | null;
  onOpenSet: (set: SavedStudySet) => void;
  onNewSet: () => void;
  /**
   * True only after the parent's hydration effect ran. The history list
   * renders from localStorage data, so on the server — and during the
   * client's very first paint — it must show a placeholder instead, or the
   * SSR HTML (empty list) mismatches the hydrated DOM (real list rows).
   */
  isHydrated: boolean;
}

// ---------------------------------------------------------------------------
// SIDEBAR SET LIST — module-level component (was a nested closure before,
// which remounted the whole list on every AppShell render and replayed
// animations at the wrong times). Staggers on mount; a set created within
// the last 4s gets a one-shot glow so its arrival is noticed.
// ---------------------------------------------------------------------------
function SidebarSetList({
  sets,
  activeSetId,
  isCollapsed,
  onSelect,
}: {
  sets: SavedStudySet[];
  activeSetId: string | null;
  isCollapsed: boolean;
  onSelect: (set: SavedStudySet) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="flex flex-col gap-1 px-2"
      variants={listVariants}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
    >
      {sets.map((set) => {
        const isActive = set.id === activeSetId;
        const isNew = Date.now() - set.createdAt < 4000;
        return (
          <motion.div key={set.id} variants={itemVariants}>
            <button
              onClick={() => onSelect(set)}
              title={set.title}
              aria-label={set.title}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
                isActive
                  ? "bg-accent/10 text-accent hover:bg-accent/15"
                  : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
                isCollapsed && "justify-center gap-0 px-0",
                isNew && "new-item-glow"
              )}
            >
              <div
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  isActive ? "bg-accent" : "bg-border"
                )}
              />
              {/* Label collapses smoothly (max-w + opacity) instead of
                  popping out mid-width-animation */}
              <span
                className={cn(
                  "truncate whitespace-nowrap font-medium transition-all duration-300",
                  isCollapsed ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100"
                )}
              >
                {set.title}
              </span>
            </button>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SIDEBAR CONTENT — shared by the desktop rail and the mobile drawer. Now a
// stable module-level component (see SidebarSetList note).
// ---------------------------------------------------------------------------
function SidebarContent({
  isCollapsed,
  onToggleCollapse,
  savedSets,
  activeSetId,
  isHydrated,
  onOpenSet,
  onNewSet,
  onAfterAction,
}: {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  savedSets: SavedStudySet[];
  activeSetId: string | null;
  isHydrated: boolean;
  onOpenSet: (set: SavedStudySet) => void;
  onNewSet: () => void;
  /** Runs after any nav action — closes the mobile drawer (no-op on desktop) */
  onAfterAction: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Sidebar Header */}
      <div className={cn("mb-6 flex shrink-0 items-center justify-between", isCollapsed ? "px-0" : "px-2")}>
        <div
          className={cn(
            "flex items-center gap-2 overflow-hidden whitespace-nowrap transition-all duration-300",
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Sparkles size={16} />
          </div>
          <h1 className="font-display text-base font-semibold text-text-primary">
            Notes Buddy
          </h1>
        </div>

        {isCollapsed && (
          <div className="flex w-full justify-center pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Sparkles size={16} />
            </div>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent lg:block"
        >
          {/* One icon, rotated 180° when collapsed — clear state feedback */}
          <PanelLeftClose
            size={18}
            className={cn("transition-transform duration-300", isCollapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* New Study Set Action */}
      <div className={cn("shrink-0", isCollapsed ? "px-0" : "px-2")}>
        <button
          onClick={() => {
            onNewSet();
            onAfterAction();
          }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-black transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface",
            isCollapsed && "gap-0 p-2.5"
          )}
          aria-label="New Study Set"
          title="New Study Set"
        >
          <PenLine size={16} className="shrink-0" />
          <span
            className={cn(
              "whitespace-nowrap transition-all duration-300",
              isCollapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"
            )}
          >
            New Study Set
          </span>
        </button>
      </div>

      {/* History Area (Scrollable) */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className={cn("mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-text-muted", isCollapsed ? "text-center" : "px-3")}>
          {isCollapsed ? "..." : "Recent"}
        </div>

        {/* History Items — gated behind isHydrated: the server paints an
            empty state and the client's first paint must match it (the real
            list arrives only after the hydration effect, in a later render). */}
        {!isHydrated ? (
          !isCollapsed && (
            <p className="px-3 py-4 text-center text-sm text-text-muted">Loading…</p>
          )
        ) : savedSets.length === 0 ? (
          !isCollapsed && (
            <p className="px-3 py-4 text-center text-sm text-text-muted">
              No saved sets
            </p>
          )
        ) : (
          <SidebarSetList
            sets={savedSets}
            activeSetId={activeSetId}
            isCollapsed={isCollapsed}
            onSelect={(set) => {
              onOpenSet(set);
              onAfterAction();
            }}
          />
        )}
      </div>
    </div>
  );
}

export function AppShell({ children, savedSets, activeSetId, onOpenSet, onNewSet, isHydrated }: AppShellProps) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const reduceMotion = useReducedMotion();

  // Restore the collapsed rail for this tab session — read in an effect so
  // SSR and the first client paint agree (expanded), then the rail settles
  // with the same 300ms ease instead of a hydration-mismatch snap.
  React.useEffect(() => {
    try {
      if (sessionStorage.getItem(COLLAPSED_KEY) === "true") setIsCollapsed(true);
    } catch {
      // Storage unavailable (private mode etc.) — rail just starts expanded
    }
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setIsCollapsed((c) => {
      const next = !c;
      try {
        sessionStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // Best-effort persistence only
      }
      return next;
    });
  }, []);

  const closeMobile = React.useCallback(() => setIsMobileOpen(false), []);

  // Close mobile sidebar on Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) setIsMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  return (
    <div className="flex min-h-screen min-h-dvh w-full bg-background">
      {/* Skip link — first focusable element on the page, visible on focus
          (was previously stranded inside the hidden desktop aside) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-on-accent focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(600px circle at 80% 10%, rgba(214,156,174,0.08), transparent 60%)",
        }}
      />

      {/* Desktop Sidebar — the width transition drives the whole layout: the
          main area is a flex sibling, so it resizes in the SAME 300ms ease
          (no sidebar-animates-while-content-jumps mismatch). overflow-hidden
          keeps inner labels from wrapping mid-animation. */}
      <aside
        aria-label="Sidebar navigation"
        className={cn(
          "hidden shrink-0 flex-col overflow-hidden border-r border-border bg-surface/50 p-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex",
          isCollapsed ? "w-[72px]" : "w-[260px] xl:w-[280px]"
        )}
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
          savedSets={savedSets}
          activeSetId={activeSetId}
          isHydrated={isHydrated}
          onOpenSet={onOpenSet}
          onNewSet={onNewSet}
          onAfterAction={closeMobile}
        />
      </aside>

      {/* Mobile drawer — framer-motion slide + backdrop fade with a real exit
          animation (the old CSS-transition version could not animate unmount,
          so closing snapped). Unmounts when closed, so no focus/aria traps;
          taps land immediately, the animation never blocks interaction. */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
              className="fixed inset-0 z-40 bg-black/80 lg:hidden"
              onClick={closeMobile}
              aria-hidden="true"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-surface p-4 lg:hidden"
              aria-label="Mobile Navigation"
            >
              <div className="mb-4 flex items-center justify-end">
                <button
                  onClick={closeMobile}
                  aria-label="Close sidebar"
                  className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {/* Mobile drawer always uses the expanded layout */}
                <SidebarContent
                  isCollapsed={false}
                  onToggleCollapse={() => {}}
                  savedSets={savedSets}
                  activeSetId={activeSetId}
                  isHydrated={isHydrated}
                  onOpenSet={onOpenSet}
                  onNewSet={onNewSet}
                  onAfterAction={closeMobile}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Workspace */}
      <main id="main-content" className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border/50 bg-background/50 px-4 lg:hidden">
          <button
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open sidebar"
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <Menu size={20} />
          </button>
          <span className="font-display font-medium text-text-primary">AI Study Notes Buddy</span>
        </header>

        {/* Main Scroll Area */}
        <div className="flex flex-1 flex-col overflow-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col xl:max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
