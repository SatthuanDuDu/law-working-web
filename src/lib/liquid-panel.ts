/**
 * Shared panel chrome. Class name kept for call-site stability; surfaces are
 * solid SaaS cards (no backdrop-blur / liquid glass).
 */
export const liquidPanelClass =
  "liquid-glass rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-card)] transition-[box-shadow,border-color] duration-200 hover:shadow-[0_4px_6px_-1px_rgba(15,23,42,0.06),0_2px_4px_-2px_rgba(15,23,42,0.04)]";
