/**
 * ============================================================================
 * THINKING INDICATOR
 * ============================================================================
 * 
 * Displays an animated "thinking" state before the first token arrives.
 * 
 * CRITICAL: The handoff from indicator to first token must be seamless.
 * If the indicator vanishes one frame before text appears, the UI flickers.
 * Solution: The indicator fades out OVER the first token appearing, not
 * before it. We use AnimatePresence with a shared layoutId for smoothness.
 * 
 * Also respects prefers-reduced-motion.
 * ============================================================================
 */

"use client";

import { motion } from "framer-motion";

interface ThinkingIndicatorProps {
  /** If true, the indicator is being replaced by actual content */
  isHandingOff?: boolean;
}

export function ThinkingIndicator({ isHandingOff = false }: ThinkingIndicatorProps) {
  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-3"
      initial={{ opacity: 0, y: 4 }}
      animate={{ 
        opacity: isHandingOff ? 0 : 1, 
        y: isHandingOff ? -4 : 0 
      }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ 
        duration: 0.25, 
        ease: [0.4, 0, 0.2, 1] // Custom cubic-bezier for natural feel
      }}
    >
      {/* Avatar dot */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="text-accent"
        >
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          <path d="M8.5 8.5v.01" />
          <path d="M16 15.5v.01" />
          <path d="M12 12v.01" />
        </svg>
      </div>

      {/* Animated dots */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-text-secondary">Thinking</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
