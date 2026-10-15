// Every string a component exposes to assistive technology comes from its typed `messages`:
// English defaults, overridable per component or once for a tree. Parameterised messages
// are functions with typed parameters; plurals use the locale's plural rules (no ICU parser).

/** A component's messages: strings, or functions of typed parameters returning strings. */
export type Messages = Readonly<Record<string, string | ((...args: never) => string)>>

/** Overrides for `M`: only its keys, with the same types (unknown keys do not compile). */
export type MessageOverrides<M extends Messages> = { readonly [K in keyof M]?: M[K] | undefined }

/** Defaults, then each override in order (later wins), key by key. */
export function resolveMessages<M extends Messages>(
  defaults: M,
  ...overrides: readonly (MessageOverrides<M> | undefined)[]
): M {
  let out: M = defaults
  for (const o of overrides) {
    if (!o) continue
    const defined = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
    // Only M's keys with M's value types can be present (MessageOverrides<M>).
    out = { ...out, ...defined } as M
  }
  return out
}

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { readonly other: string }

/** Picks the plural form for `n` with the locale's rules; `#` is replaced by the number. */
export function plural(locale: string, n: number, forms: PluralForms): string {
  const rule = pluralRules(locale).select(n)
  return (forms[rule] ?? forms.other).replaceAll("#", number(locale).format(n))
}

// --- Cached Intl formatters: repeated calls never construct new ones ---

const cache = new Map<string, unknown>()
function cached<T>(kind: string, locale: string, options: object | undefined, create: () => T): T {
  const key = `${kind}|${locale}|${JSON.stringify(options ?? {})}`
  let value = cache.get(key) as T | undefined
  if (value === undefined) {
    value = create()
    cache.set(key, value)
  }
  return value
}

export const number = (locale: string, options?: Intl.NumberFormatOptions) =>
  cached("number", locale, options, () => new Intl.NumberFormat(locale, options))

/** Search usage, base sensitivity by default: "é" equals "e". */
export const collator = (locale: string, options?: Intl.CollatorOptions) =>
  cached(
    "collator",
    locale,
    options,
    () => new Intl.Collator(locale, { usage: "search", sensitivity: "base", ...options }),
  )

export const pluralRules = (locale: string, options?: Intl.PluralRulesOptions) =>
  cached("plural", locale, options, () => new Intl.PluralRules(locale, options))

export const segmenter = (locale: string, options?: Intl.SegmenterOptions) =>
  cached("segmenter", locale, options, () => new Intl.Segmenter(locale, options))

/** The formatters, as one object. */
export const format = { number, collator, pluralRules, segmenter } as const
