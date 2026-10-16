// Where focus goes when an element that holds it is about to disappear without being a layer
// (a dismissed Alert): the consumer's target, else the next tab stop after it in document
// order, else the previous one before it — never `body`.

import type { ModalityEnv, MotionEnv } from "../env/capabilities"
import { focusSafely } from "./focus-safely"
import type { FocusTarget } from "./focus-scope"
import { tabbables } from "./focus-scope"

declare const process: { env: { NODE_ENV?: string } }

/**
 * Moves focus out of `el` before it goes away. `target`: the consumer's element, `false` to
 * leave focus alone, `null`/undefined for the next (else previous) tab stop outside `el`.
 * Returns whether focus was moved.
 */
export function focusPast(
  el: HTMLElement,
  target: FocusTarget | undefined,
  env: ModalityEnv & Partial<MotionEnv>,
  name = "element",
): boolean {
  if (target === false) return false
  let next: HTMLElement | null | undefined = target
  if (!next) {
    const body = el.ownerDocument.body
    const stops = tabbables(body).filter((s) => !el.contains(s))
    const FOLLOWING = 4 // Node.DOCUMENT_POSITION_FOLLOWING, without a Node global in tests
    next =
      stops.find((s) => el.compareDocumentPosition(s) & FOLLOWING) ??
      stops.filter((s) => !(el.compareDocumentPosition(s) & FOLLOWING)).at(-1)
  }
  if (!next) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[rind-ui] ${name}: no element to move focus to after it closes; pass finalFocus`,
      )
    }
    return false
  }
  void focusSafely(next, env, "programmatic")
  return true
}
