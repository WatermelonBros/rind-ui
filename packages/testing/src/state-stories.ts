// State stories: every contract state has a Storybook story leaving the component in it,
// whose ARIA snapshot documents what assistive technology sees in that state.
import type { AnyContract } from "@rind-ui/core"

/** A story file's `states` export: contract scope → machine state → story export name. */
export type StateStories = Readonly<Record<string, Readonly<Record<string, string>>>>

/** States of `contract` with no state story (empty when covered). */
export function missingStateStories(
  contract: AnyContract,
  stories: StateStories,
  storyExports: Readonly<Record<string, unknown>>,
): string[] {
  const own = stories[contract.scope] ?? {}
  return Object.keys(contract.states).flatMap((state) => {
    const name = own[state]
    if (!name) return [`${contract.scope}: no state story for "${state}"`]
    if (!(name in storyExports))
      return [`${contract.scope}: state story "${name}" for "${state}" is not exported`]
    return []
  })
}
