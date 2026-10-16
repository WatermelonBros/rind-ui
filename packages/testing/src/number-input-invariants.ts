// The Number Input's step invariants (add-number-input "Number Input Invariants") that need
// the DOM or a count across steps: one tabbable element (the input), no focus moved by a
// touch or assistive-technology step, and one onValueChange per change the oracle applied.
import type { numberInputContract } from "@rind-ui/core"
import type { ConsumerInvariant } from "./model"

export interface NumberInputStepInvariants {
  readonly invariants: readonly ConsumerInvariant<typeof numberInputContract>[]
  /** Forgets what was recorded (call in `setup`). */
  reset(): void
}

const ROOT = '[data-scope="number-input"][data-part="root"]'
const TABBABLE = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]'

/**
 * `changes` reads how often the page's `onValueChange` ran, `expectedChanges` the oracle's
 * (pass a counting `onValueChange` in the oracle's props).
 */
export function numberInputStepInvariants(
  options: { readonly changes?: () => number; readonly expectedChanges?: () => number } = {},
): NumberInputStepInvariants {
  let lastActive: Element | null | undefined
  // A step whose action pressed a pointer (a held stepper, also in the virtual run) is a
  // pointer gesture: its focus rule is the mouse's, not assistive technology's.
  let pointerPressed = false
  globalThis.document?.addEventListener(
    "pointerdown",
    () => {
      pointerPressed = true
    },
    true,
  )
  return {
    invariants: [
      {
        name: "number-input-one-tab-stop",
        check: async () => {
          const doc = globalThis.document
          if (!doc) return undefined
          for (const root of Array.from(doc.querySelectorAll(ROOT))) {
            const stops = Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
              (el) => el.tabIndex >= 0 && !(el as HTMLInputElement).disabled,
            )
            const extra = stops.filter((el) => el.getAttribute("data-part") !== "input")
            if (extra.length > 0) {
              return `parts in the tab order besides the input: ${extra.map((el) => el.getAttribute("data-part") ?? el.tagName).join(", ")}`
            }
          }
          return undefined
        },
      },
      {
        name: "number-input-touch-keeps-focus",
        check: async ({ stepModality: modality }) => {
          const active = globalThis.document?.activeElement ?? null
          const before = lastActive
          lastActive = active
          const pressed = pointerPressed
          pointerPressed = false
          if (pressed && modality === "virtual") return undefined
          if (before === undefined || (modality !== "touch" && modality !== "virtual"))
            return undefined
          if (active === before) return undefined
          const moved = active?.closest?.(ROOT) ? active.getAttribute("data-part") : null
          return moved ? `a ${modality} step moved focus to the ${moved}` : undefined
        },
      },
      {
        name: "number-input-change-count",
        check: async () => {
          if (!options.changes || !options.expectedChanges) return undefined
          const [have, want] = [options.changes(), options.expectedChanges()]
          return have === want ? undefined : `onValueChange ran ${have} times, the oracle ${want}`
        },
      },
    ],
    reset() {
      lastActive = undefined
      pointerPressed = false
    },
  }
}
