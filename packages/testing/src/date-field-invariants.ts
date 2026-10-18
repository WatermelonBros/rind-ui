// The Date Field's step invariants (add-date-field "Segment Invariants") that need the DOM or
// a count across steps: only editable segments are tab stops, and one onValueChange per change
// the oracle applied.
import type { dateFieldContract, dateRangeFieldContract } from "@rind-ui/core"
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
            // A picker's trigger and clear trigger are tab stops too (spec "Picker — Opening").
            const extra = stops.filter(
              (el) =>
                !el.hasAttribute("data-editable") &&
                !["trigger", "clear-trigger"].includes(el.getAttribute("data-part") ?? ""),
            )
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

/**
 * The range Date Field's change count (spec "Range Mode — Pair Invariants"): `onValueChange`
 * runs exactly as often as the derived value changed, read as the pair of hidden inputs
 * changing between steps. Call `reset()` in the model's setup.
 */
export function dateRangeStepInvariants(options: { readonly changes: () => number }) {
  let last = ""
  let expected = 0
  const pair = () => {
    const hidden = globalThis.document?.querySelectorAll<HTMLInputElement>(
      '[data-scope="date-field"][data-part="hidden-input"]',
    )
    return Array.from(hidden ?? [], (h) => h.value).join("|")
  }
  return {
    /** After the render: the pair it starts with is not a change. */
    reset: () => {
      last = pair()
      expected = 0
    },
    invariants: [
      {
        name: "date-range-change-count",
        check: async () => {
          const now = pair()
          if (now !== last) expected++
          last = now
          const have = options.changes()
          return have === expected
            ? undefined
            : `onValueChange ran ${have} times, the derived value changed ${expected} times`
        },
      },
    ] as readonly ConsumerInvariant<typeof dateRangeFieldContract>[],
  }
}
