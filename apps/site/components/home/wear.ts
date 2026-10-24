// The builder's skin on the whole page (any-look.tsx): the visitor's look rewritten as the
// site's own tokens (app/globals.css) on <html>, so the nav, the titles, the bands and the
// buttons wear it, not only the preview. The site is the demo. Taken off by passing null.

import { type Look, SITE_FONTS, textOn } from "./skins"

/** The site's tokens a skin speaks for; everything else keeps the phase's. */
const TOKENS = [
  "--bg",
  "--ink",
  "--acc",
  "--acc-deep",
  "--card",
  "--line",
  "--on",
  "--soft",
  "--muted",
  "--paper",
  "--r",
  "--bw",
  "--shadow",
  "--shadow-sm",
  "--text",
  "--display",
  "--btn-r",
  "--ground-ink",
  "--on-ground-ink",
  "--wordmark",
  "--wordmark-deep",
  "--on-acc",
] as const

/** The shadows a skin names, as the site's two sizes (large, small). */
function shadows(l: Look): readonly [string, string] {
  switch (l.shadow) {
    case "flat":
      return ["none", "none"]
    case "soft":
      return ["0 8px 0 var(--soft), 0 28px 48px rgb(0 0 0 / 0.14)", "0 5px 0 var(--soft)"]
    case "hard":
      return ["8px 8px 0 var(--ink)", "4px 4px 0 var(--ink)"]
    case "glow":
      return [
        "0 0 0 2px var(--acc), 0 0 44px color-mix(in oklab, var(--acc) 55%, transparent)",
        "0 0 0 2px var(--acc), 0 0 18px color-mix(in oklab, var(--acc) 45%, transparent)",
      ]
    case "bevel":
      return [
        "inset -3px -3px 0 rgb(0 0 0 / 0.45), inset 3px 3px 0 rgb(255 255 255 / 0.8)",
        "inset -2px -2px 0 rgb(0 0 0 / 0.45), inset 2px 2px 0 rgb(255 255 255 / 0.8)",
      ]
    case "clay":
      return [
        "inset -6px -8px 14px rgb(0 0 0 / 0.12), inset 6px 8px 14px rgb(255 255 255 / 0.6), 0 14px 28px rgb(0 0 0 / 0.14)",
        "inset -3px -4px 8px rgb(0 0 0 / 0.12), 0 6px 14px rgb(0 0 0 / 0.12)",
      ]
  }
}

/** Puts `look` on the page, or takes the page's own look back with null. */
export function wear(look: (Look & { readonly brand: string }) | null) {
  const root = document.documentElement
  if (!look) {
    for (const t of TOKENS) root.style.removeProperty(t)
    root.removeAttribute("data-worn")
    return
  }
  const ink = textOn(look.surface)
  const [shadow, small] = shadows(look)
  const body = look.font === "display" ? "sans" : look.font
  const set: Record<(typeof TOKENS)[number], string> = {
    "--bg": look.surface,
    "--ink": ink,
    "--acc": look.brand,
    "--acc-deep": `color-mix(in oklab, ${look.brand} 70%, ${ink})`,
    "--card": `color-mix(in oklab, ${look.surface} 90%, ${ink})`,
    "--line": look.border > 0 ? ink : "transparent",
    "--on": textOn(look.brand),
    "--soft": `color-mix(in oklab, ${look.brand} 45%, ${look.surface})`,
    "--muted": `color-mix(in oklab, ${look.surface} 86%, ${ink})`,
    "--paper": `color-mix(in oklab, ${look.surface} 94%, ${ink})`,
    "--r": `${Math.round(look.radius * 1.4)}px`,
    "--bw": `${look.border}px`,
    "--shadow": shadow,
    "--shadow-sm": small,
    "--text": `${SITE_FONTS[body]}, system-ui, sans-serif`,
    "--display": `${SITE_FONTS[look.font]}, sans-serif`,
    "--btn-r": look.radius >= 20 ? "99px" : `${look.radius}px`,
    // the dark bands (tests, the outro) turn the skin inside out
    "--ground-ink": ink,
    "--on-ground-ink": look.surface,
    "--wordmark": look.brand,
    "--on-acc": textOn(look.brand),
    "--wordmark-deep": `color-mix(in oklab, ${look.brand} 65%, #000)`,
  }
  for (const t of TOKENS) root.style.setProperty(t, set[t])
  root.setAttribute("data-worn", "")
}
