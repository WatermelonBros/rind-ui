type Props = Readonly<Record<string | symbol, unknown>>

/**
 * A part's own props from several core modules (connect, press, hover, focus): later
 * values win, except same-named handlers, which all run in order. All of them are the
 * part's, so consumer layers still go through `mergeProps`.
 */
export function joinHandlers(...sources: Props[]): Record<string, unknown> {
  const out: Record<string | symbol, unknown> = {}
  for (const source of sources) {
    // Symbol keys too: the CRITICAL marker must reach mergeProps (override warnings).
    for (const key of Reflect.ownKeys(source)) {
      const value = source[key]
      const prev = out[key]
      out[key] =
        typeof key === "string" &&
        /^on[A-Z]/.test(key) &&
        typeof prev === "function" &&
        typeof value === "function"
          ? (e: unknown) => {
              prev(e)
              value(e)
            }
          : value
    }
  }
  return out
}
