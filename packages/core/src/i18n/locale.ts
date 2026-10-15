import type { LocaleSource } from "../env/capabilities"
import { directionOf } from "./direction"

/**
 * The default locale: the document element's `lang`, then the browser language; follows
 * `languagechange`. The direction is the locale's. On the server: "en", "ltr".
 */
export function documentLocale(
  getDocument: () => Document | undefined = () => globalThis.document,
): Required<LocaleSource> {
  const locale = () =>
    canonicalLocale(getDocument()?.documentElement.lang) ??
    canonicalLocale(globalThis.navigator?.language) ??
    "en"
  return {
    locale,
    dir: () => directionOf(locale()),
    subscribe(listener) {
      const doc = getDocument()
      const win = doc?.defaultView
      if (!doc || !win) return () => {}
      win.addEventListener("languagechange", listener)
      // <html lang> set by the app (client-side language switch).
      const observer = new win.MutationObserver(listener)
      observer.observe(doc.documentElement, { attributes: true, attributeFilter: ["lang"] })
      return () => {
        win.removeEventListener("languagechange", listener)
        observer.disconnect()
      }
    },
  }
}

/**
 * A BCP 47 tag Intl accepts, or undefined. Pages often say `lang="en_US"` (underscore),
 * which makes every Intl constructor throw.
 */
export function canonicalLocale(tag: string | undefined): string | undefined {
  if (!tag) return undefined
  try {
    return Intl.getCanonicalLocales(tag.replace(/_/g, "-"))[0]
  } catch {
    return undefined
  }
}

/** A fixed locale (provider or prop), with its direction unless one is given. */
export function fixedLocale(locale: string, dir?: "ltr" | "rtl"): LocaleSource {
  return { locale: () => locale, dir: () => dir ?? directionOf(locale) }
}

/**
 * `dir` and `lang` for a part rendered outside its component's root (a portal at the end of
 * body would otherwise inherit the document's).
 */
export function localeAttrs(source: LocaleSource): {
  readonly dir: "ltr" | "rtl"
  readonly lang: string
} {
  return { dir: source.dir(), lang: source.locale() }
}
