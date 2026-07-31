/**
 * ============================================================================
 * SCROLL ANCHOR COMPONENT
 * ============================================================================
 * 
 * A small floating button that appears when the user has scrolled up
 * and new content is streaming in. Clicking it jumps to the bottom.
 * 
 * Shows a badge with the count of new messages since scroll-up.
 * ============================================================================
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollAnchorProps {
  visible: boolean;
  newMessageCount: number;
  onClick: () => void;
}

export function ScrollAnchor({ visible, newMessageCount, onClick }: ScrollAnchorProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          onClick={onClick}
          className={cn(
            "absolute bottom-20 left-1/2 z-10 -translate-x-1/2",
            "flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2",
            "text-sm text-text-primary shadow-lg shadow-black/20",
            "hover:bg-surface hover:border-accent/30 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-accent/30"
          )}
        >
          <ArrowDown size={14} className="text-accent" />
          <span>Jump to latest</span>
          {newMessageCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-white">
              {newMessageCount}
            </span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
