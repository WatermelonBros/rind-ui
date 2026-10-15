// Waits for a part's exit animations: the finite animations running on its own element (CSS
// transitions, CSS animations, Web Animations) read through getAnimations() after the closed
// state is applied, so an animation that already ended before observation is never waited
// for (zag#3349). Infinite animations (a spinner) and descendants' animations are ignored
// unless `subtree`. Resolves at once without getAnimations (jsdom with
// @rind-ui/testing/setup), with nothing running, or in a hidden document.

/** Resolves when `node`'s finite exit animations have finished (or the signal aborts). */
export async function waitForExit(
  node: Element,
  options: { readonly subtree?: boolean } = {},
  signal?: AbortSignal,
): Promise<void> {
  const doc = node.ownerDocument
  const finite = () =>
    typeof node.getAnimations !== "function" || doc.hidden
      ? []
      : node.getAnimations({ subtree: options.subtree === true }).filter((a) => {
          const timing = a.effect?.getComputedTiming()
          return timing?.endTime !== Number.POSITIVE_INFINITY && a.playState !== "finished"
        })
  for (;;) {
    if (signal?.aborted) return
    const running = finite()
    if (running.length === 0) return
    // A cancelled animation rejects `finished`: settle, then look again, since a cancelled
    // one may have been replaced by a new one (a retargeted transition).
    // An abort (re-open during the exit) ends the wait at once, not when the animation ends.
    const aborted = new Promise<void>((resolve) => {
      if (signal?.aborted) resolve()
      signal?.addEventListener("abort", () => resolve(), { once: true })
    })
    await Promise.race([
      Promise.all(running.map((a) => a.finished.catch(() => undefined))),
      aborted,
    ])
  }
}
