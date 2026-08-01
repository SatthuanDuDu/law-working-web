/**
 * Shared liquid-glass panel chrome — reserved for chrome surfaces (header, sidebar,
 * overlays/dialogs). Dense data surfaces (list/table cards) should pass `solid` to
 * <Card> instead: stacking blur under every row tanks scroll perf and readability.
 */
export const liquidPanelClass =
  "liquid-glass border bg-transparent backdrop-blur-[24px] backdrop-saturate-[1.4] motion-reduce:backdrop-blur-none";
