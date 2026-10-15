// Text direction of a locale: the platform's locale text info when available, otherwise a
// list of right-to-left scripts and languages.

const RTL_SCRIPTS = new Set([
  "Arab",
  "Hebr",
  "Thaa",
  "Syrc",
  "Nkoo",
  "Adlm",
  "Rohg",
  "Mand",
  "Samr",
])
const RTL_LANGUAGES = new Set([
  "ar",
  "he",
  "iw",
  "fa",
  "ur",
  "ps",
  "sd",
  "ug",
  "yi",
  "dv",
  "ckb",
  "ku",
  "syr",
  "nqo",
])

type WithTextInfo = Intl.Locale & {
  getTextInfo?: () => { direction?: string }
  textInfo?: { direction?: string }
}

export function isRTL(locale: string): boolean {
  try {
    const l = new Intl.Locale(locale) as WithTextInfo
    const info = l.getTextInfo?.() ?? l.textInfo
    if (info?.direction) return info.direction === "rtl"
    const script = l.maximize().script
    if (script) return RTL_SCRIPTS.has(script)
    return RTL_LANGUAGES.has(l.language)
  } catch {
    return false
  }
}

export const directionOf = (locale: string): "ltr" | "rtl" => (isRTL(locale) ? "rtl" : "ltr")
