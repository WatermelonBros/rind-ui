// Pseudo-localisation: replaces every message of a component, so a test can prove no
// string reaching assistive technology is hard-coded (i18n-messages "No Hard-Coded AT
// Strings").
import type { Messages } from "@rind-ui/core"

const ACCENTS: Record<string, string> = {
  a: "á",
  e: "é",
  i: "í",
  o: "ó",
  u: "ú",
  c: "ç",
  n: "ñ",
  s: "š",
  y: "ý",
  z: "ž",
  A: "Á",
  E: "É",
  I: "Í",
  O: "Ó",
  U: "Ú",
  C: "Ç",
  N: "Ñ",
  S: "Š",
  Y: "Ý",
  Z: "Ž",
}

/** "Close" → "⟦Çłóšé⟧": still readable, never equal to (or containing) the English. */
export const pseudo = (text: string) => `⟦${[...text].map((c) => ACCENTS[c] ?? c).join("")}⟧`

/** Every message replaced: strings pseudo-localised, functions' results too. */
export function pseudoMessages<M extends Messages>(messages: M): M {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(messages)) {
    out[key] =
      typeof value === "function"
        ? (...args: never[]) => pseudo((value as (...a: never[]) => string)(...args))
        : pseudo(value)
  }
  // Same keys, each with a value of the same kind (string or function) as in M.
  return out as M
}

/**
 * The English defaults (string messages) that appear in `texts` — accessible names,
 * descriptions, aria-roledescription, aria-valuetext, announcements. Empty when every AT
 * string comes from the messages.
 */
export function englishLeaks(defaults: Messages, texts: readonly string[]): string[] {
  const english = Object.values(defaults).filter((v): v is string => typeof v === "string")
  return english.filter((e) => texts.some((t) => t.includes(e)))
}
