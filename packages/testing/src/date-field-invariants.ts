// The Date Field's step invariants (add-date-field "Segment Invariants") that need the DOM or
// a count across steps: only editable segments are tab stops, and one onValueChange per change
// the oracle applied.
import type { dateFieldContract } from "@rind-ui/core"
import type { ConsumerInvariant } from "./model"

export interface DateFieldStepInvariants {
  readonly invariants: readonly ConsumerInvariant<typeof dateFieldContract>[]
}

const ROOT = '[data-scope="date-field"][data-part="root"]'
const TABBABLE = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]'

/**
 * `changes` reads how often the page's `onValueChange` ran, `expectedChanges` the oracle's
 * (pass a counting `onValueChange` in the oracle's props).
 */
export function dateFieldStepInvariants(
  options: { readonly changes?: () => number; readonly expectedChanges?: () => number } = {},
): DateFieldStepInvariants {
  return {
    invariants: [
      {
        name: "date-field-tab-stops-are-segments",
        check: async () => {
          const doc = globalThis.document
          if (!doc) return undefined
          for (const root of Array.from(doc.querySelectorAll(ROOT))) {
            const stops = Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
              (el) => el.tabIndex >= 0 && !(el as HTMLInputElement).disabled,
            )
            const extra = stops.filter((el) => !el.hasAttribute("data-editable"))
            if (extra.length > 0) {
              return `tab stops besides the segments: ${extra.map((el) => el.getAttribute("data-part") ?? el.tagName).join(", ")}`
            }
          }
          return undefined
        },
      },
      {
        name: "date-field-change-count",
        check: async () => {
          if (!options.changes || !options.expectedChanges) return undefined
          const [have, want] = [options.changes(), options.expectedChanges()]
          return have === want ? undefined : `onValueChange ran ${have} times, the oracle ${want}`
        },
      },
    ],
  }
}
