/** Shared trigger + dropdown panel styles for composer pickers (aspect, style, layout, …). */

export const COMPOSER_MENU_TRIGGER_BTN =
  "relative flex h-9 min-h-9 w-full min-w-0 items-center rounded-xl border border-border/90 bg-background px-3 pr-9 text-left text-xs font-medium text-foreground shadow-sm outline-none transition-[border-color,box-shadow] hover:border-foreground/15 hover:bg-surface-hover/30 focus-visible:border-accent-violet/45 focus-visible:ring-2 focus-visible:ring-accent-violet/15 data-[state=open]:border-accent-violet/45 data-[state=open]:ring-2 data-[state=open]:ring-accent-violet/15";

export const COMPOSER_MENU_CONTENT =
  "min-w-0 w-[min(calc(100vw-2rem),20rem)] p-1";

export const COMPOSER_MENU_SCROLL =
  "max-h-[min(65vh,18rem)] overflow-y-auto overflow-x-hidden px-1 py-0.5";

export const COMPOSER_MENU_ITEM =
  "items-start rounded-lg px-2 py-1.5 text-left data-[highlighted]:bg-surface-hover";
