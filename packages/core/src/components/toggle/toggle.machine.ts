// Toggle (design "Machine"): two real states bound to the controllable `pressed`, so the
// graph has the two edges the model tests cover, and controlled mode, `$sync` and
// `$reverted` come from the runtime. Disabled is not a guard: the press interactions send
// no event while disabled (button-like-element), one source of truth.

import type { BlurEvent, FocusEvent, PressEvent } from "../../a11y/events"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type TogglePressEvent = PressEvent & { readonly type: "PRESS" }
export type ToggleEvent = TogglePressEvent | FocusEvent | BlurEvent

export interface ToggleProps {
  readonly pressed?: boolean | undefined
  readonly defaultPressed?: boolean | undefined
  readonly onPressedChange?:
    | ((pressed: boolean, details: ChangeDetails<ToggleEvent>) => void)
    | undefined
}

export const toggleMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ToggleProps
    events: ToggleEvent
    env: object
    context: { focused: boolean }
    values: "pressed"
  }>(),
  actions: {
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => set("focused", false),
  },
}).machine({
  id: "toggle",
  initial: "off",
  context: () => ({ focused: false }),
  values: { pressed: { fallback: false, states: { off: false, on: true } } },
  on: { FOCUS: { actions: ["setFocused"] }, BLUR: { actions: ["clearFocused"] } },
  states: {
    off: { on: { PRESS: "on" } },
    on: { on: { PRESS: "off" } },
  },
})

export type ToggleMachine = typeof toggleMachine
