// The Checkbox's Enter invariant (add-checkbox "Checkbox Invariants"), exported as a
// consumer invariant for `testMachine(checkboxContract, { invariants })`: it needs the keys
// the step pressed, which the shared invariant API does not carry. DOM adapter.
import type { checkboxContract } from "@rind-ui/core"
import type { ConsumerInvariant } from "./model"

export interface CheckboxStepInvariants {
  readonly invariants: readonly ConsumerInvariant<typeof checkboxContract>[]
  /** Forgets the keys recorded so far (call in `setup`). */
  reset(): void
  /** Removes the document listener. */
  dispose(): void
}

const isControl = (t: EventTarget | null): t is HTMLElement =>
  t instanceof HTMLElement &&
  t.getAttribute("data-scope") === "checkbox" &&
  t.getAttribute("data-part") === "control"

/** `checkbox-enter-never-changes`: an Enter key on the Control never changes its value. */
export function checkboxStepInvariants(): CheckboxStepInvariants {
  let presses: { target: HTMLElement; before: string | null }[] = []
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || !isControl(e.target)) return
    presses.push({ target: e.target, before: e.target.getAttribute("aria-checked") })
  }
  document.addEventListener("keydown", onKey, true)
  return {
    invariants: [
      {
        name: "checkbox-enter-never-changes",
        check: async () => {
          const seen = presses
          presses = []
          for (const p of seen) {
            const after = p.target.getAttribute("aria-checked")
            if (after !== p.before) {
              return `Enter on the control changed aria-checked from "${p.before}" to "${after}"`
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
    },
  }
}
