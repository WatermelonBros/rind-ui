// The Form's step invariants (add-form "Form Invariants"), exported as consumer invariants
// for `testMachine(formContract, { invariants })`: they need the step that ran and the
// page's announcement log, which the shared Invariant API does not carry. DOM adapter.
import type { formContract } from "@rind-ui/core"
import { installAnnouncementLog } from "./announcements"
import type { ConsumerInvariant } from "./model"

type FormInvariant = ConsumerInvariant<typeof formContract>

export interface FormStepInvariants {
  /** Pass to `testMachine(formContract, { invariants })`. */
  readonly invariants: readonly FormInvariant[]
  /** Starts recording which Form button ran (call in `setup`); returns the cleanup. */
  track(): () => void
  /** Forgets announcements and steps between tests. */
  reset(): void
}

/**
 * - `form-focus-only-on-attempt`: a step that is not a submit attempt (Validate, Reset)
 *   never moves focus into a Field (ariakit#2397, ariakit#6307);
 * - `form-no-field-announcement`: an attempt announces the Form's summary only, never a
 *   Field's own message. `isSummary` recognises the summary (default: the English one).
 */
export function formStepInvariants(
  isSummary: (message: string) => boolean = (m) => m.endsWith("fields have errors"),
): FormStepInvariants {
  let lastStep: string | null = null
  let seen = 0
  const focus: FormInvariant = {
    name: "form-focus-only-on-attempt",
    check: async ({ env }) => {
      const step = lastStep
      lastStep = null
      if (step !== "Validate" && step !== "Reset") return undefined
      for (const f of await env.part("root").scoped("field", "root").all()) {
        if ((await f.attr("data-focus")) !== null) {
          return `a "${step}" step moved focus into the Field "${(await f.attr("data-name")) ?? ""}"`
        }
      }
      return undefined
    },
  }
  const announcement: FormInvariant = {
    name: "form-no-field-announcement",
    check: async () => {
      const log = installAnnouncementLog()
      const added = log.slice(seen)
      seen = log.length
      const field = added.find((a) => !isSummary(a.message))
      return field ? `a Field announced "${field.message}" besides the Form summary` : undefined
    },
  }
  return {
    invariants: [focus, announcement],
    track() {
      const onClick = (e: Event) => {
        const name = (e.target as Element | null)?.closest("button")?.textContent
        if (name === "Submit" || name === "Reset" || name === "Validate") lastStep = name
      }
      document.addEventListener("click", onClick, true)
      return () => document.removeEventListener("click", onClick, true)
    },
    reset() {
      lastStep = null
      seen = 0
      installAnnouncementLog().length = 0
    },
  }
}
