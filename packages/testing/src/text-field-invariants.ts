// The Text Field's announcement invariant (add-text-field "Text Field Invariants"), exported
// as a consumer invariant for `testMachine(textFieldContract, { invariants })`: it reads the
// page's announcement log, which the shared Invariant API does not carry. DOM adapter.
import type { textFieldContract } from "@rind-ui/core"
import { installAnnouncementLog } from "./announcements"
import type { ConsumerInvariant } from "./model"

export interface TextFieldStepInvariants {
  readonly invariants: readonly ConsumerInvariant<typeof textFieldContract>[]
  /** Forgets announcements between tests (call in `setup`). */
  reset(): void
}

/**
 * - `text-field-silent-while-composing`: no announcement is made during a composition;
 * - `text-field-value-only-from-composition` (when `composedText` is given): during a
 *   composition the value only ever holds the story's own text and what the composition
 *   adds, so a variant writing the value while composing (kobalte#737) fails.
 */
export function textFieldStepInvariants(
  options: { readonly composedText?: RegExp } = {},
): TextFieldStepInvariants {
  let seen = 0
  return {
    invariants: [
      ...(options.composedText
        ? [
            {
              name: "text-field-value-only-from-composition",
              check: async ({ env, state }) => {
                if (state !== "composing") return undefined
                const input = env.part("input")
                const c = (await input.exists()) ? input : env.part("textarea")
                const value = await c.value()
                return options.composedText?.test(value)
                  ? undefined
                  : `the value is "${value}" during a composition`
              },
            } satisfies ConsumerInvariant<typeof textFieldContract>,
          ]
        : []),
      {
        name: "text-field-silent-while-composing",
        check: async ({ state }) => {
          const log = installAnnouncementLog()
          const added = log.slice(seen)
          seen = log.length
          return state === "composing" && added.length > 0
            ? `announced "${added[0]?.message}" while composing`
            : undefined
        },
      },
    ],
    reset() {
      seen = 0
      installAnnouncementLog().length = 0
    },
  }
}
