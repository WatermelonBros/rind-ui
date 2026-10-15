// What every rind-ui label shares (openspec label-interaction): the Label, a control's own
// Label (control-label) and Field.Label. Native label behaviour does the rest; this only
// adds the double-click selection guard, focus forwarding for targets a <label> cannot
// label, and the development check of what `for` points at.

import { focusSafely } from "../../dom/focus-safely"
import type { ModalityEnv, MotionEnv } from "../../env/capabilities"

declare const process: { env: { NODE_ENV?: string } }

/** Elements a `<label>` can label (HTML "labelable elements"). */
const LABELABLE = new Set(["button", "meter", "output", "progress", "select", "textarea"])

export function isLabelable(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  if (tag === "input") return (el as HTMLInputElement).type !== "hidden"
  return LABELABLE.has(tag)
}

/** A press that started here must keep the browser's default (word selection, steppers). */
const INTERACTIVE = "button, input, select, textarea, a[href], [data-rind-pressable]"

/**
 * The element `for` names, looked up in the label's own root (a shadow root works), or the
 * labelable element the label wraps.
 */
export function labelTarget(label: Element, htmlFor: string | undefined): Element | null {
  if (htmlFor) {
    const root = label.getRootNode() as Document | ShadowRoot
    return "getElementById" in root ? root.getElementById(htmlFor) : null
  }
  return (label as HTMLLabelElement).control ?? null
}

export interface LabelInteractionOptions {
  /** The element the label names, resolved at event time. */
  readonly target: () => Element | null
  /** False: the target is not labelable, so a press focuses it (no `for`). */
  readonly forwardsFocus: () => boolean
  /** Controls override where focus goes (a group focuses its tab stop). */
  readonly focusTarget?: (() => void) | undefined
}

type Env = ModalityEnv & Partial<MotionEnv>

/** The label's handlers. They run after the consumer's (merge order). */
export function labelInteraction(env: Env, options: LabelInteractionOptions) {
  return {
    onMouseDown: (event: unknown) => {
      const e = event as MouseEvent
      // Only a double click's selection; a single mousedown still moves focus (base-ui#586).
      if (e.detail <= 1 || e.defaultPrevented) return
      if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return
      e.preventDefault()
    },
    onClick: (event: unknown) => {
      const e = event as MouseEvent
      // Clicks are never cancelled; a descendant's preventDefault stops the activation.
      if (e.defaultPrevented || !options.forwardsFocus()) return
      if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return
      if (options.focusTarget) return options.focusTarget()
      const target = options.target()
      if (target instanceof HTMLElement) void focusSafely(target, env, "programmatic")
    },
  }
}

const warned = new WeakSet<Element>()

/**
 * After commit: what `for` points at. Warns once per label (development) when the id
 * matches nothing or a non-labelable element; returns whether the label must forward focus
 * (and drop `for`).
 */
export function checkLabelTarget(label: Element, htmlFor: string | undefined): boolean {
  if (!htmlFor) return false
  const target = labelTarget(label, htmlFor)
  const labelable = target !== null && isLabelable(target)
  if (process.env.NODE_ENV !== "production" && !labelable && !warned.has(label)) {
    warned.add(label)
    const what = target
      ? `a <${target.tagName.toLowerCase()}>, which a label cannot name`
      : "no element"
    console.warn(
      `[rind-ui] label "${(label.textContent ?? "").trim()}": for="${htmlFor}" points at ${what}. Use the control's own Label part, a Field, or aria-labelledby on the control.`,
    )
  }
  return target !== null && !labelable
}
