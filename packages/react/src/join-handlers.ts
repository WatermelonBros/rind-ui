type Props = Readonly<Record<string, unknown>>

/**
 * A part's own props from several core modules (connect, press, hover, focus): later
 * values win, except same-named handlers, which all run in order. All of them are the
 * part's, so consumer layers still go through `mergeProps`.
 */
export function joinHandlers(...sources: Props[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      const prev = out[key]
      out[key] =
        typeof prev === "function" && typeof value === "function" && /^on[A-Z]/.test(key)
          ? (e: unknown) => {
              prev(e)
              value(e)
            }
          : value
    }
  }
  return out
}
