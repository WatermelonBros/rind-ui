// The Text Field's key invariants (text-field "Text Field Invariants": Escape and Enter), as
// consumer invariants for `testMachine(textFieldContract, { invariants })`: they read the
// Escape and Enter key events of each step, which the shared Invariant API does not carry.
// DOM adapter (a capture listener on the window records the events).
import type { textFieldContract } from "@rind-ui/core"
import type { ConsumerInvariant } from "./model"

interface KeyRecord {
  readonly event: KeyboardEvent
  readonly input: HTMLInputElement
  /** The value and editability when the key went down, before any handler ran. */
  readonly value: string
  readonly editable: boolean
  readonly composing: boolean
  readonly submitsBefore: number
  /** Taken when the next key goes down (or at the check): what this key alone did. */
  after?: { readonly value: string; readonly submits: number }
}

export interface TextFieldKeyStepInvariants {
  readonly invariants: readonly ConsumerInvariant<typeof textFieldContract>[]
  /** Starts recording for a new story (call in `setup`); returns the cleanup. */
  reset(): () => void
}

/**
 * - `text-field-escape-consumed`: an Escape on a non-empty editable field left focus in the
 *   input and was prevented; on an empty one (or read-only, disabled) it was not, so an
 *   enclosing layer gets it (react-spectrum#5480);
 * - `text-field-ime-keys`: an Escape or Enter marked composing neither cleared the value nor
 *   searched (react-spectrum#10249, #6421). `submits` counts the story's `onSubmit` calls.
 */
export function textFieldKeyStepInvariants(
  options: { readonly submits?: () => number } = {},
): TextFieldKeyStepInvariants {
  let keys: KeyRecord[] = []
  const submits = options.submits ?? (() => 0)
  const close = (k: KeyRecord | undefined) => {
    if (k && !k.after) k.after = { value: k.input.value, submits: submits() }
  }
  const take = () => {
    close(keys.at(-1))
    const out = keys
    keys = []
    return out
  }
  return {
    invariants: [
      {
        name: "text-field-escape-consumed",
        check: async () => {
          // Read without taking: the IME invariant below runs next and consumes the records.
          for (const k of keys) {
            if (k.event.key !== "Escape" || k.composing) continue
            const handles = k.value !== "" && k.editable
            if (handles && !k.event.defaultPrevented) {
              return `Escape on "${k.value}" was not prevented (an enclosing layer would also close)`
            }
            if (handles && k.input.ownerDocument.activeElement !== k.input) {
              return "Escape cleared the field but focus left the input"
            }
            if (!handles && k.event.defaultPrevented) {
              return `Escape on ${k.value === "" ? "an empty" : "a non-editable"} field was prevented (it belongs to the enclosing layer)`
            }
          }
          return undefined
        },
      },
      {
        name: "text-field-ime-keys",
        check: async () => {
          for (const k of take()) {
            if (!k.composing) continue
            if (k.event.key === "Escape" && k.value !== "" && k.after?.value === "") {
              return "an Escape during a composition cleared the value"
            }
            if (k.event.key === "Enter" && (k.after?.submits ?? 0) > k.submitsBefore) {
              return "an Enter during a composition searched (onSubmit was called)"
            }
          }
          return undefined
        },
      },
    ],
    reset() {
      keys = []
      const onKey = (event: KeyboardEvent) => {
        const input = event.target
        if (!(input instanceof HTMLInputElement) || input.type !== "search") return
        if (event.key !== "Escape" && event.key !== "Enter") return
        close(keys.at(-1))
        keys.push({
          event,
          input,
          value: input.value,
          editable: !input.disabled && !input.readOnly,
          // The component's own composition state counts too (a key without isComposing).
          composing:
            event.isComposing || event.keyCode === 229 || input.hasAttribute("data-composing"),
          submitsBefore: submits(),
        })
      }
      window.addEventListener("keydown", onKey, true)
      return () => window.removeEventListener("keydown", onKey, true)
    },
  }
}
