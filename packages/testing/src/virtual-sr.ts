// A virtual screen reader over a container: its spoken phrase log, for announcement
// sequences and reading order. @guidepup/virtual-screen-reader is an optional peer.

type Virtual = typeof import("@guidepup/virtual-screen-reader")["virtual"]

/**
 * Starts the virtual screen reader on `container`, runs `run(virtual)` (move with
 * `virtual.next()`, act, or let the component announce), and returns every phrase spoken.
 */
export async function spokenLog(
  container: Node,
  run: (virtual: Virtual) => unknown | Promise<unknown>,
): Promise<string[]> {
  const { virtual } = await import("@guidepup/virtual-screen-reader")
  await virtual.start({ container })
  try {
    await run(virtual)
    return await virtual.spokenPhraseLog()
  } finally {
    await virtual.stop()
  }
}

/** The live-region phrases of a spoken log ("polite: Copied" → { polite, "Copied" }). */
export function liveAnnouncements(log: readonly string[]) {
  return log.flatMap((phrase) => {
    const match = /^(polite|assertive): (.*)$/.exec(phrase)
    return match ? [{ priority: match[1] as "polite" | "assertive", message: match[2] ?? "" }] : []
  })
}
