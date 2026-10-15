// Fixture for add-a11y-foundations: a button and a toggle built on the press, modality and
// focus modules. Not public components (Button and Toggle get their own changes).
import {
  type BlurEvent,
  type ChangeDetails,
  type ContextMenuEvent,
  type FocusEvent,
  type LongPressEvent,
  type ModalityEnv,
  type PlatformInfo,
  type PressEvent,
  type SchedulerEnv,
  setup,
  type,
} from "@rind-ui/core"

export type PressFixtureEnv = ModalityEnv & PlatformInfo & SchedulerEnv
export type PressFixtureEvent =
  | PressEvent
  | LongPressEvent
  | ContextMenuEvent
  | FocusEvent
  | BlurEvent

export interface ToggleProps {
  readonly pressed?: boolean | undefined
  readonly defaultPressed?: boolean | undefined
  readonly onPressedChange?:
    | ((pressed: boolean, details: ChangeDetails<PressFixtureEvent>) => void)
    | undefined
  readonly disabled?: boolean | undefined
}

export const toggleMachine = setup({
  types: type<{
    props: ToggleProps
    events: PressFixtureEvent
    env: PressFixtureEnv
    context: { focused: boolean }
    values: "pressed"
  }>(),
  guards: { enabled: ({ props }) => props.disabled !== true },
  actions: {
    focus: ({ set }) => set("focused", true),
    blur: ({ set }) => set("focused", false),
  },
}).machine({
  id: "toggle",
  initial: "off",
  context: () => ({ focused: false }),
  values: { pressed: { fallback: false, states: { on: true, off: false } } },
  on: { FOCUS: { actions: ["focus"] }, BLUR: { actions: ["blur"] } },
  states: {
    off: { on: { PRESS: { target: "on", guard: "enabled" } } },
    on: { on: { PRESS: { target: "off", guard: "enabled" } } },
  },
})

export interface CounterProps {
  readonly onPress?: ((event: PressEvent) => void) | undefined
  readonly disabled?: boolean | undefined
}

/** A button that counts activations (each PRESS is one). */
export const counterMachine = setup({
  types: type<{
    props: CounterProps
    events: PressFixtureEvent
    env: PressFixtureEnv
    context: { count: number; focused: boolean }
  }>(),
  guards: { enabled: ({ props }) => props.disabled !== true },
  actions: {
    count: ({ set, context, props, event }) => {
      set("count", context.count + 1)
      if (event.type === "PRESS") props.onPress?.(event)
    },
    focus: ({ set }) => set("focused", true),
    blur: ({ set }) => set("focused", false),
  },
}).machine({
  id: "counter",
  initial: "idle",
  context: () => ({ count: 0, focused: false }),
  on: { FOCUS: { actions: ["focus"] }, BLUR: { actions: ["blur"] } },
  states: { idle: { on: { PRESS: { guard: "enabled", actions: ["count"] } } } },
})

export type ToggleMachine = typeof toggleMachine
export type CounterMachine = typeof counterMachine
