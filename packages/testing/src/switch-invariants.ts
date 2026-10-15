// The Switch's name invariant (add-switch "Switch Invariants"), exported as a consumer
// invariant for `testMachine(switchContract, { invariants })`: it compares the name across
// the steps of one path, which the shared invariant API does not carry.
import type { switchContract } from "@rind-ui/core"
import type { ConsumerInvariant } from "./model"

export interface SwitchStepInvariants {
  readonly invariants: readonly ConsumerInvariant<typeof switchContract>[]
  /** Forgets the recorded name (call in `setup`). */
  reset(): void
}

/** `switch-name-stable`: the Control's accessible name is the same in every state. */
export function switchStepInvariants(): SwitchStepInvariants {
  let first: string | null = null
  return {
    invariants: [
      {
        name: "switch-name-stable",
        check: async ({ env }) => {
          const control = env.part("control")
          if ((await control.count()) === 0) return undefined
          const name = await control.accessibleName()
          if (first === null) first = name
          return name === first
            ? undefined
            : `the name changed with the state: "${first}" → "${name}"`
        },
      },
    ],
    reset() {
      first = null
    },
  }
}
