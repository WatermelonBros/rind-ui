import type { FocusCause } from "../a11y/events"
import type { ModalityEnv, MotionEnv } from "../env/capabilities"

/**
 * rind-ui's one focus operation. It keeps the current modality (a focus moved after a key
 * stays `keyboard`), records the move's `cause`, scrolls the target into view with the
 * nearest-edge rule (honouring scroll-padding, and instant under reduced motion), and, for
 * assistive technology, waits for running transitions on the target so the screen reader
 * does not read a half-rendered element.
 */
export async function focusSafely(
  el: HTMLElement,
  env: ModalityEnv & Partial<MotionEnv>,
  cause: Extract<FocusCause, "layer" | "navigation" | "programmatic"> = "programmatic",
): Promise<void> {
  if (env.modality.modality() === "virtual") {
    const running = el.getAnimations?.() ?? []
    await Promise.all(running.map((a) => a.finished.catch(() => undefined)))
    if (!el.isConnected) return
  }
  // Already focused: no focus event would consume the mark.
  if (el.ownerDocument.activeElement !== el) {
    env.modality.markFocus(el, cause)
    el.focus({ preventScroll: true })
    // Not focusable (or focus refused): drop the mark so the next focus is not misread.
    if (el.ownerDocument.activeElement !== el) env.modality.unmarkFocus(el)
  }
  el.scrollIntoView?.({
    block: "nearest",
    inline: "nearest",
    behavior: env.motion?.reducedMotion() ? "instant" : "auto",
  })
}
