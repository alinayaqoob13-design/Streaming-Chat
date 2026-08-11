"use client";

import * as React from "react";
import { Menu, PenLine, PanelLeftClose, PanelLeft, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedStudySet } from "@/types/notes";

export interface AppShellProps {
  children: React.ReactNode;
  savedSets: SavedStudySet[];
  activeSetId: string | null;
  onOpenSet: (set: SavedStudySet) => void;
  onNewSet: () => void;
}

export function AppShell({ children, savedSets, activeSetId, onOpenSet, onNewSet }: AppShellProps) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Close mobile sidebar on Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) setIsMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Sidebar Header */}
      <div className={cn("mb-6 flex shrink-0 items-center justify-between", isCollapsed ? "px-0" : "px-2")}>
        <div className={cn("flex items-center gap-2", isCollapsed && "hidden")}>
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
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent lg:block"
        >
          {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* New Study Set Action */}
      <div className={cn("shrink-0", isCollapsed ? "px-0" : "px-2")}>
        <button
          onClick={() => {
            onNewSet();
            setIsMobileOpen(false); // Close mobile drawer when action taken
          }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-black transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface",
            isCollapsed && "p-2.5"
          )}
          aria-label="New Study Set"
          title="New Study Set"
        >
          <PenLine size={16} className="shrink-0" />
          {!isCollapsed && <span>New Study Set</span>}
        </button>
      </div>

      {/* History Area (Scrollable) */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className={cn("mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-text-muted", isCollapsed ? "text-center" : "px-3")}>
          {isCollapsed ? "..." : "Recent"}
        </div>
        
        {/* History Items */}
        <div className="flex flex-col gap-1 px-2">
          {savedSets.length === 0 ? (
            !isCollapsed && (
              <p className="px-3 py-4 text-center text-sm text-text-muted">
                No saved sets
              </p>
            )
          ) : (
            savedSets.length > 0 && savedSets.map((set) => {
              const isActive = set.id === activeSetId;
              return (
                <button
                  key={set.id}
                  onClick={() => {
                    onOpenSet(set);
                    setIsMobileOpen(false); // Close drawer after selection
                  }}
                  title={set.title}
                  aria-label={set.title}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
                    isActive
                      ? "bg-accent/10 text-accent hover:bg-accent/15"
                      : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
                    isCollapsed && "justify-center px-0"
                  )}
                >
                  <div
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      isActive ? "bg-accent" : "bg-border"
                    )}
                  />
                  {!isCollapsed && <span className="truncate font-medium">{set.title}</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen min-h-dvh w-full bg-background">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(600px circle at 80% 10%, rgba(214,156,174,0.08), transparent 60%)",
        }}
      />

      {/* Desktop Sidebar */}
      <aside
        aria-label="Sidebar navigation"
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-surface/50 p-4 transition-all duration-300 lg:flex",
          isCollapsed ? "w-[72px]" : "w-[260px] xl:w-[280px]"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      
      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] -translate-x-full flex-col border-r border-border bg-surface p-4 transition-transform duration-300 lg:hidden",
          isMobileOpen && "translate-x-0"
        )}
        aria-label="Mobile Navigation"
        aria-hidden={!isMobileOpen}
        inert={!isMobileOpen ? true : undefined}
      >
        <div className="mb-4 flex items-center justify-end">
          <button 
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close sidebar"
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {/* We force isCollapsed=false for mobile view to reuse SidebarContent */}
          <SidebarContent />
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex min-w-0 flex-1 flex-col">
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
