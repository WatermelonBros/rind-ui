// The Accordion's step invariants (add-accordion "Contract"), exported as consumer
// invariants for `testMachine(accordionContract, { invariants })`: one needs the value the
// consumer tracks (the page does not expose it, and the oracle cannot see which items are
// disabled), the other needs the keys the step pressed. DOM adapter.
import type { accordionContract } from "@rind-ui/core"
import type { ConsumerInvariant } from "./model"

export interface AccordionStepInvariants {
  readonly invariants: readonly ConsumerInvariant<typeof accordionContract>[]
  /** Forgets the keys recorded so far (call in `setup`). */
  reset(): void
  /** Removes the document listeners. */
  dispose(): void
}

const NAVIGATION_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"])

const expandedIn = (root: Element | null) =>
  Array.from(root?.querySelectorAll('[data-scope="accordion"][data-part="trigger"]') ?? [])
    .filter((t) => t.getAttribute("aria-expanded") === "true")
    .map((t) => t.id)
    .join(" ")

interface Press {
  readonly key: string
  readonly target: HTMLElement
  readonly expanded: string
  prevented: boolean
}

/**
 * - `accordion-expanded-matches-value` (when `value` and `labels` are given): each trigger's
 *   `aria-expanded` equals its item's membership in the value the consumer tracks through
 *   `onValueChange` (`labels`: item value → trigger label), so a variant that does not report
 *   a close (ark#1656) fails;
 * - `accordion-arrows-inert`: without `keyboardNavigation`, an arrow, Home or End key on a
 *   trigger moves no focus, changes no expanded item and is not prevented.
 */
export function accordionStepInvariants(
  options: {
    readonly value?: () => readonly string[]
    readonly labels?: Readonly<Record<string, string>>
  } = {},
): AccordionStepInvariants {
  let presses: Press[] = []
  const onKey = (e: KeyboardEvent) => {
    const t = e.target
    if (!(t instanceof HTMLElement) || !NAVIGATION_KEYS.has(e.key)) return
    if (t.getAttribute("data-scope") !== "accordion" || t.getAttribute("data-part") !== "trigger") {
      return
    }
    const root = t.closest('[data-scope="accordion"][data-part="root"]')
    presses.push({ key: e.key, target: t, expanded: expandedIn(root), prevented: false })
  }
  // After every handler: was the key prevented?
  const onKeyAfter = (e: KeyboardEvent) => {
    const p = presses.find((x) => x.target === e.target && x.key === e.key)
    if (p) p.prevented = e.defaultPrevented
  }
  document.addEventListener("keydown", onKey, true)
  window.addEventListener("keydown", onKeyAfter)
  const { value, labels } = options
  return {
    invariants: [
      ...(value && labels
        ? [
            {
              name: "accordion-expanded-matches-value",
              check: async ({ env }) => {
                const open = value()
                for (const [item, label] of Object.entries(labels)) {
                  const t = env.part("trigger", { role: "button", name: label })
                  if (!(await t.exists())) continue
                  const expanded = (await t.attr("aria-expanded")) === "true"
                  if (expanded !== open.includes(item)) {
                    return `"${label}" is ${expanded ? "expanded" : "collapsed"} but the value ${JSON.stringify(open)} ${open.includes(item) ? "contains" : "does not contain"} "${item}"`
                  }
                }
                return undefined
              },
            } satisfies ConsumerInvariant<typeof accordionContract>,
          ]
        : []),
      {
        name: "accordion-arrows-inert",
        check: async ({ props }) => {
          const seen = presses
          presses = []
          if (props["keyboardNavigation"] === true) return undefined
          for (const p of seen) {
            const root = p.target.closest('[data-scope="accordion"][data-part="root"]')
            if (p.prevented) return `${p.key} on a trigger was prevented without keyboardNavigation`
            if (p.target.ownerDocument.activeElement !== p.target) {
              return `${p.key} on a trigger moved focus without keyboardNavigation`
            }
            if (expandedIn(root) !== p.expanded) {
              return `${p.key} on a trigger changed the expanded items without keyboardNavigation`
            }
          }
          return undefined
        },
      },
    ],
    reset() {
      presses = []
    },
    dispose() {
      document.removeEventListener("keydown", onKey, true)
      window.removeEventListener("keydown", onKeyAfter)
    },
  }
}
