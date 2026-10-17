// Text Field (design §2): `idle` / `composing`, a controllable `value` the machine never
// writes back to the DOM (uncontrolled, the input owns its value; controlled, the adapter
// renders the prop). A Clear is the only DOM write, done by the adapter through the native
// setter plus one `input` event, which comes back here as an ordinary INPUT with its reason.
// One preset adds the password visibility and the Escape / Enter keys (merge-text-field-parts):
// the builder stays internal, so there is one Text Field machine.

import type { Modality } from "../../contract/env"
import type { AnnouncerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionFn, EffectFn, GuardFn, Machine } from "../../machine/types"
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

/** A preset's own types, added to Text Field's (props, events, controllable values). */
export interface TextFieldPresetTypes {
  readonly props?: object
  readonly events?: { readonly type: string }
  readonly values?: string
}

/** Text Field's machine types extended by a preset's. */
export type TextFieldTypes<X extends TextFieldPresetTypes = Record<never, never>> = {
  props: TextFieldProps & (X extends { readonly props: infer P } ? P : unknown)
  events: TextFieldEvent | (X extends { readonly events: infer E } ? E : never)
  env: Env
  context: TextFieldContext
  values: "value" | (X extends { readonly values: infer V } ? V : never)
}

type PresetEventType<X extends TextFieldPresetTypes> = X extends {
  readonly events: { readonly type: infer K }
}
  ? K & string
  : never

/** What a preset adds: a scope, global events with their guards and actions, effects. */
export interface TextFieldPreset<X extends TextFieldPresetTypes = Record<never, never>> {
  readonly scope?: string
  /** Extra controllable values (`visible` → `visible` / `defaultVisible` / `onVisibleChange`). */
  readonly values?: {
    readonly [K in X extends { readonly values: infer V extends string } ? V : never]: {
      readonly fallback: unknown
    }
  }
  /** Global events (accepted in `idle` and `composing`), by type. */
  readonly events?: {
    readonly [K in PresetEventType<X>]: {
      readonly guard?: string | { readonly and: readonly string[] }
      readonly actions: readonly string[]
    }
  }
  readonly actions?: Readonly<Record<string, ActionFn<TextFieldTypes<X>>>>
  readonly guards?: Readonly<Record<string, GuardFn<TextFieldTypes<X>>>>
  readonly effects?: Readonly<Record<string, EffectFn<TextFieldTypes<X>>>>
  /** Service effects (active for the service's life). */
  readonly serviceEffects?: readonly string[]
}

const textFieldTypes = type<TextFieldTypes>()

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
export function buildTextFieldMachine<X extends TextFieldPresetTypes = Record<never, never>>(
  preset: TextFieldPreset<X> = {},
) {
  type PresetEvent = { readonly guard?: unknown; readonly actions: readonly string[] }
  const events: Readonly<Record<string, PresetEvent>> = preset.events ?? {}
  const extraOn = Object.fromEntries(
    Object.entries(events).map(([type, t]) => [
      type,
      { ...(t.guard ? { guard: t.guard } : {}), actions: t.actions },
    ]),
  )
  const values: Readonly<Record<string, unknown>> = preset.values ?? {}
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
    values: { value: { fallback: "" }, ...(values as Record<string, never>) },
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
  return {
    // Sound: the definition is Text Field's plus the preset's events, actions, guards and
    // values, all merged by name at runtime; the preset's implementations are typed against
    // the extended types, which is what a service of this machine is created with.
    machine: machine as unknown as Machine<"idle" | "composing", TextFieldTypes<X>>,
    scope: preset.scope ?? "text-field",
  }
}

export type TextFieldVisibilityHideReason = "SUBMIT" | "RESET"

/** The native key event, as far as the machine touches it. */
export interface TextFieldKey {
  preventDefault(): void
  stopPropagation(): void
}

/** Visibility (`type="password"`) and the keys (Escape clears, Enter submits). */
export type TextFieldOwnEvent =
  | {
      readonly type: "VISIBILITY.TOGGLE"
      readonly modality: Modality
      /** Focus is in the input (a pointer press that kept it there): announce the change. */
      readonly inputFocused: boolean
      /** The input's selection when the press started, restored after the `type` change. */
      readonly selection: readonly [number, number] | null
    }
  | { readonly type: "VISIBILITY.HIDE"; readonly reason: TextFieldVisibilityHideReason }
  | { readonly type: "ESCAPE"; readonly event: TextFieldKey; readonly composing: boolean }
  | { readonly type: "SUBMIT"; readonly event: TextFieldKey; readonly composing: boolean }

export interface TextFieldSubmitDetails {
  /** The Enter key event: `preventDefault()` stops the form's implicit submission. */
  readonly event: TextFieldKey
}

export interface TextFieldOwnProps {
  readonly visible?: boolean | undefined
  readonly defaultVisible?: boolean | undefined
  /** Translated by the adapter into `(visible, { reason: "PRESS" | "SUBMIT" | "RESET" })`. */
  readonly onVisibleChange?: ((visible: boolean, details: unknown) => void) | undefined
  /** Escape clears a non-empty editable value (default: true for `type="search"`). */
  readonly escapeClears?: boolean | undefined
  readonly onSubmit?: ((value: string, details: TextFieldSubmitDetails) => void) | undefined
  /** Watches the input's form; returns the cleanup. Submit always hides, reset unless prevented. */
  readonly watchForm?:
    | ((on: { readonly submit: () => void; readonly reset: () => void }) => () => void)
    | undefined
  /** Restores the input's selection once the new `type` is rendered (same frame). */
  readonly keepSelection?: ((selection: readonly [number, number]) => void) | undefined
}

export const { machine: textFieldMachine } = buildTextFieldMachine<{
  props: TextFieldOwnProps
  events: TextFieldOwnEvent
  values: "visible"
}>({
  scope: "text-field",
  values: { visible: { fallback: false } },
  events: {
    // Read-only allows it (nothing about the value changes); disabled refuses.
    "VISIBILITY.TOGGLE": { guard: "notDisabled", actions: ["toggleVisible"] },
    "VISIBILITY.HIDE": { actions: ["hide"] },
    ESCAPE: {
      guard: { and: ["keyNotComposing", "escapeClears", "hasValue", "editable"] },
      actions: ["consumeKey", "clearOnEscape"],
    },
    SUBMIT: { guard: "keyNotComposing", actions: ["callOnSubmit"] },
  },
  guards: {
    notDisabled: ({ props }) => !props.disabled && !props.focusableWhenDisabled,
    // Safari reports the commit Enter after compositionend: the key says it still composes.
    keyNotComposing: ({ event }) =>
      !((event.type === "ESCAPE" || event.type === "SUBMIT") && event.composing),
    escapeClears: ({ props }) => props.escapeClears === true,
    hasValue: ({ values }) => values.value !== "",
  },
  actions: {
    toggleVisible: ({ event, values, props, env, set }) => {
      if (event.type !== "VISIBILITY.TOGGLE") return
      const next = !values.visible
      set("visible", next)
      if (event.selection) props.keepSelection?.(event.selection)
      // A focused trigger speaks its pressed state; only focus in the input needs words.
      if (event.inputFocused) {
        env.announcer.announce({
          message: props.messages.visibilityAnnouncement(next),
          priority: "polite",
          key: `text-field-${props.id}-visibility`,
        })
      }
    },
    hide: ({ values, set }) => {
      if (values.visible) set("visible", false)
    },
    // Only a taken transition consumes the key; otherwise it reaches the enclosing layer.
    consumeKey: ({ event }) => {
      if (event.type !== "ESCAPE") return
      event.event.preventDefault()
      event.event.stopPropagation()
    },
    clearOnEscape: ({ props }) => props.clearInput("ESCAPE", true),
    callOnSubmit: ({ event, props, values }) => {
      if (event.type === "SUBMIT") props.onSubmit?.(values.value, { event: event.event })
    },
  },
  effects: {
    // Live props (radix#4157): the hide is proposed through whatever is current at the event.
    formVisibilityReset: ({ props, send }) =>
      props.watchForm?.({
        submit: () => send({ type: "VISIBILITY.HIDE", reason: "SUBMIT" }),
        reset: () => send({ type: "VISIBILITY.HIDE", reason: "RESET" }),
      }),
  },
  serviceEffects: ["formVisibilityReset"],
})
export type TextFieldMachine = typeof textFieldMachine
