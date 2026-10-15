// Text Field (design §2): `idle` / `composing`, a controllable `value` the machine never
// writes back to the DOM (uncontrolled, the input owns its value; controlled, the adapter
// renders the prop). A Clear is the only DOM write, done by the adapter through the native
// setter plus one `input` event, which comes back here as an ordinary INPUT with its reason.
// Presets (Password Input, Search Field) build on the same definition.

import type { Modality } from "../../contract/env"
import type { AnnouncerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionFn, EffectFn, GuardFn, Types } from "../../machine/types"
import type { TextFieldMessages } from "./text-field.messages"

export type TextFieldReason = "INPUT" | "CLEAR" | "RESET" | (string & {})

export type TextFieldEvent =
  | {
      readonly type: "INPUT"
      readonly value: string
      readonly composing: boolean
      /** INPUT, or the reason of a Clear (the adapter's one-shot flag). */
      readonly reason: TextFieldReason
      readonly event: Event | null
    }
  | { readonly type: "COMPOSITION.START" }
  | { readonly type: "COMPOSITION.END"; readonly value: string; readonly event: Event | null }
  /** A Clear request: the adapter writes the input and the INPUT follows with `reason`. */
  | { readonly type: "CLEAR"; readonly modality: Modality; readonly reason: TextFieldReason }
  /** A form reset: the adapter re-reads the DOM value. */
  | { readonly type: "RESET"; readonly value: string }
  | { readonly type: "FOCUS"; readonly modality: Modality }
  | { readonly type: "BLUR" }

export interface TextFieldDetails {
  readonly reason: TextFieldReason
  /** The native event (null for a reset read). */
  readonly event: Event | null
  readonly isComposing: boolean
}

export interface TextFieldProps {
  readonly value?: string | null | undefined
  readonly defaultValue?: string | undefined
  /** Translated by the adapter into `(value, TextFieldDetails)`. */
  readonly onValueChange?: ((value: string, details: unknown) => void) | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  /** Disabled but focusable: rendered read-only + aria-disabled, nothing changes the value. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** The limit the count announcement uses (maxLength or a soft max). */
  readonly limit?: number | undefined
  /** Announce when this many or fewer remain (default max(10, 20% of the limit)). */
  readonly threshold?: number | undefined
  readonly count?: ((value: string) => number) | undefined
  readonly messages: TextFieldMessages
  readonly id: string
  /** Asks the adapter to clear the input (native setter + one `input` event) and focus it. */
  readonly clearInput: (reason: TextFieldReason, focus: boolean) => void
}

export interface TextFieldContext {
  focused: boolean
}

type Env = AnnouncerEnv

/** UTF-16 code units, each line break counted once: what `maxLength` enforces. */
export const defaultCount = (value: string) => value.replace(/\r\n/g, "\n").length

/** The count announcement, or null when the count is not near the limit. */
export function countAnnouncement(
  value: string,
  props: Pick<TextFieldProps, "limit" | "threshold" | "count" | "messages">,
): string | null {
  const { limit } = props
  if (limit === undefined) return null
  const used = (props.count ?? defaultCount)(value)
  const remaining = limit - used
  const threshold = props.threshold ?? Math.max(10, Math.ceil(limit * 0.2))
  if (remaining < 0) return props.messages.charactersOver(-remaining)
  return remaining <= threshold ? props.messages.charactersRemaining(remaining) : null
}

/** What a preset adds: a scope, global events with their guards and actions, effects. */
export interface TextFieldPreset {
  readonly scope?: string
  /**
   * Extra controllable values (`visible` → props `visible` / `defaultVisible` /
   * `onVisibleChange`), not bound to a state.
   */
  readonly values?: Readonly<Record<string, { readonly fallback: unknown }>>
  /** Global events (accepted in `idle` and `composing`), by type. */
  readonly events?: Readonly<
    Record<string, { readonly guard?: string; readonly actions: readonly string[] }>
  >
  readonly actions?: Readonly<Record<string, ActionFn<Types>>>
  readonly guards?: Readonly<Record<string, GuardFn<Types>>>
  readonly effects?: Readonly<Record<string, EffectFn<Types>>>
  /** Service effects (active for the service's life). */
  readonly serviceEffects?: readonly string[]
}

const textFieldTypes = type<{
  props: TextFieldProps
  events: TextFieldEvent
  env: Env
  context: TextFieldContext
  values: "value"
}>()

const baseActions = {
  /** Records the value: uncontrolled the DOM already shows it; controlled it is proposed. */
  setValue: ({ event, set }: Parameters<ActionFn<typeof textFieldTypes>>[0]) => {
    if (event.type === "INPUT" || event.type === "COMPOSITION.END" || event.type === "RESET") {
      set("value", event.value)
    }
  },
  setFocused: ({ set }: Parameters<ActionFn<typeof textFieldTypes>>[0]) => set("focused", true),
  clearFocused: ({ set }: Parameters<ActionFn<typeof textFieldTypes>>[0]) => set("focused", false),
  /** Past the threshold, while focused and not composing: keyed, so a typing pause speaks once. */
  announceCount: ({
    props,
    values,
    context,
    env,
  }: Parameters<ActionFn<typeof textFieldTypes>>[0]) => {
    if (!context.focused) return
    const message = countAnnouncement(values.value ?? "", props)
    if (message) {
      env.announcer.announce({ message, priority: "polite", key: `text-field-${props.id}-count` })
    }
  },
  clear: ({ props, event }: Parameters<ActionFn<typeof textFieldTypes>>[0]) => {
    if (event.type === "CLEAR") props.clearInput(event.reason, true)
  },
}

const baseGuards = {
  /** A Clear changes the value only when the field is enabled and editable. */
  editable: ({ props }: Parameters<GuardFn<typeof textFieldTypes>>[0]) =>
    !props.disabled && !props.readOnly && !props.focusableWhenDisabled,
}

/**
 * Builds the Text Field machine. The preset's events are global (both states accept them),
 * so a preset never needs to know the composition states. Static: evaluated once.
 */
export function buildTextFieldMachine(preset: TextFieldPreset = {}) {
  const extraOn = Object.fromEntries(
    Object.entries(preset.events ?? {}).map(([type, t]) => [
      type,
      { ...(t.guard ? { guard: t.guard } : {}), actions: t.actions },
    ]),
  )
  const machine = setup({
    types: textFieldTypes,
    actions: { ...baseActions, ...(preset.actions as Record<string, never>) },
    guards: { ...baseGuards, ...(preset.guards as Record<string, never>) },
    effects: { ...(preset.effects as Record<string, never>) },
  }).machine({
    id: preset.scope ?? "text-field",
    initial: "idle",
    context: () => ({ focused: false }),
    // A preset's values are merged by name; the runtime treats them like `value`.
    values: { value: { fallback: "" }, ...(preset.values as Record<string, never>) },
    effects: (preset.serviceEffects ?? []) as never[],
    on: {
      FOCUS: { actions: ["setFocused"] },
      BLUR: { actions: ["clearFocused"] },
      // A form reset re-reads the DOM value (the latest defaultValue: base-ui#5880).
      RESET: { actions: ["setValue"] },
      // Preset events: the types are the preset's; the runtime merges them by name.
      ...(extraOn as Record<string, never>),
    },
    states: {
      idle: {
        on: {
          "COMPOSITION.START": "composing",
          INPUT: { actions: ["setValue", "announceCount"] },
          CLEAR: { guard: "editable", actions: ["clear"] },
        },
      },
      composing: {
        on: {
          // Each update is reported (isComposing), never counted or announced.
          INPUT: { actions: ["setValue"] },
          "COMPOSITION.END": { target: "idle", actions: ["setValue", "announceCount"] },
        },
      },
    },
  })
  return { machine, scope: preset.scope ?? "text-field" }
}

export const { machine: textFieldMachine } = buildTextFieldMachine({})
export type TextFieldMachine = typeof textFieldMachine
