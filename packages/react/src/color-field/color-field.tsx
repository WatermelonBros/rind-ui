// Color Field and Color Channel Field parts (design §6): wiring only. The Color Field's
// machine owns the draft and the commit points; the text filter runs on the resulting text in
// `beforeinput` and again in `input` (react-spectrum#3985). The Channel Field is a Number Input
// with props computed from the channel.

import {
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorInput,
  type ColorSpace,
  colorValueMachine,
  colorValueOf,
  describeKey,
  type FieldMessages,
  type FlushRegistry,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  makeColor,
  mergeFieldProps,
  partId,
  withChannel,
  workingOf,
} from "@rind-ui/core"
import {
  acceptColorText,
  COLOR_PICKER_SCOPE,
  type ColorFieldFormat,
  type ColorFieldMessages,
  channelInputNaming,
  colorChannelFieldProps,
  colorFieldConnect,
  colorFieldFormValue,
  colorFieldKeyEvent,
  colorFieldMachine,
  colorFieldMessages,
  colorFieldPart,
  colorFieldValue,
  colorVariables,
} from "@rind-ui/core/internal"
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useColorProp } from "../color-input"
import { useFieldBindingPeek, useFieldControl } from "../field/field"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/use-field-host"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import {
  NumberInput,
  NumberInputNaming,
  type NumberInputRootProps,
} from "../number-input/number-input"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "color-field": ColorFieldMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

// The flush registry an owner (the Color Picker) provides: each field registers its `flush`.
export const ColorFlushContext = createContext<FlushRegistry | null>(null)

// --- Color Field ---

export interface ColorFieldState {
  readonly value: Color | null
  readonly text: string
  readonly dirty: boolean
  readonly invalid: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

export type ColorFieldReason = "INPUT.COMMIT" | "RESET" | "ADOPT"

interface FieldCtx {
  readonly instance: string
  readonly api: ReturnType<typeof colorFieldConnect>
  readonly state: ColorFieldState
  readonly send: ReturnType<typeof useMachine<typeof colorFieldMachine>>["send"]
  readonly inputEl: { current: HTMLInputElement | null }
  readonly hiddenEl: { current: HTMLInputElement | null }
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly format: ColorFieldFormat
  readonly alpha: boolean
  readonly setFocused: (on: boolean) => void
  readonly invalidMessage: string
  readonly value: Color | null
}
const FieldContext = createContext<FieldCtx | null>(null)
function useColorField(part: string): FieldCtx {
  const ctx = useContext(FieldContext)
  if (!ctx) throw new Error(`ColorField.${part} must be inside ColorField.Root`)
  return ctx
}

export type ColorFieldRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir" | "color"
> & {
  /** The field's parts (Label, Input, Description, ErrorMessage). */
  readonly children?: ReactNode
  readonly value?: ColorInput | null
  /** Default `null` (no colour). */
  readonly defaultValue?: ColorInput | null
  readonly onValueChange?: (
    color: Color | null,
    details: ColorChangeDetails<ColorFieldReason> & { readonly modality?: string | undefined },
  ) => void
  /** Every accepted edit of the text (the value changes only at commit points). */
  readonly onInputValueChange?: (text: string) => void
  /** `hex` (default): hex digits with an optional `#`; `css`: any CSS colour. */
  readonly format?: ColorFieldFormat
  /** Accept and show 8-digit hex (default false: the alpha never changes). */
  readonly alpha?: boolean
  readonly colorSpace?: ColorSpace
  readonly name?: string
  /** The id of the form the hidden input belongs to. */
  readonly form?: string
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  /** Marks the field invalid whatever the text (`aria-invalid`, `data-invalid`). */
  readonly invalid?: boolean
  /** Sets the direction when `dir` is not given. Default: the provider's. */
  readonly locale?: string
  /** Reading direction of the root. Default: the locale's, else the provider's. */
  readonly dir?: "ltr" | "rtl"
  readonly messages?: MessageOverrides<ColorFieldMessages>
  /** The Field's messages when the Root is the Field. */
  readonly fieldMessages?: MessageOverrides<FieldMessages>
}

const reasonOf = (r: string): ColorFieldReason =>
  r === "RESET" ? "RESET" : r === "ADOPT" ? "ADOPT" : "INPUT.COMMIT"

/** A text input for a whole colour: hex by default, any CSS colour with `format="css"`. */
function Root({
  value: valueProp,
  defaultValue: defaultProp,
  onValueChange,
  onInputValueChange,
  format = "hex",
  alpha = false,
  colorSpace,
  form,
  locale: ownLocale,
  dir: ownDir,
  messages: ownMessages,
  fieldMessages,
  children,
  id,
  ...fieldProps
}: ColorFieldRootProps) {
  const env = useEnvironment()
  const generated = useId()
  const instance = id ?? generated
  const { dir } = useLocale(ownLocale, ownDir)
  const messages = useMessages("color-field", colorFieldMessages, ownMessages)
  const parsedValue = useColorProp(valueProp ?? undefined, "value", "color-field")
  const parsedDefault = useColorProp(defaultProp ?? undefined, "defaultValue", "color-field")
  const value = valueProp === null ? null : parsedValue
  const defaultValue = defaultProp === null ? null : (parsedDefault ?? null)
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled =
    fieldProps.disabled === true || enclosing?.state.disabled === true || fieldsetDisabled
  const readOnly = fieldProps.readOnly === true || enclosing?.state.readOnly === true
  const inputEl = useRef<HTMLInputElement | null>(null)
  const hiddenEl = useRef<HTMLInputElement | null>(null)
  const [formInput] = useState(() =>
    hiddenFormInput({ input: () => hiddenEl.current, control: () => inputEl.current }, env),
  )
  const latest = useRef({ onValueChange, onInputValueChange, uncontrolled: value === undefined })
  latest.current = { onValueChange, onInputValueChange, uncontrolled: value === undefined }
  const { view, send } = useMachine(
    colorFieldMachine,
    {
      value,
      defaultValue,
      format,
      alpha,
      colorSpace,
      disabled,
      readOnly,
      onValueChange: (c, d) => {
        // Uncontrolled: the form value is current before an implicit submission reads it.
        if (latest.current.uncontrolled) {
          formInput.sync({ value: colorFieldFormValue(c) }, { dispatch: false })
        }
        latest.current.onValueChange?.(c, {
          reason: reasonOf(d.reason),
          space: c?.space ?? colorSpace ?? "rgb",
          cancel: d.cancel,
        })
      },
      onInputValueChange: (t) => latest.current.onInputValueChange?.(t),
    },
    {},
  )
  const current = colorFieldValue({ value, defaultValue, format, alpha }, view.values.value)
  const dirty = view.state !== "idle"
  const invalidDraft = view.state === "invalid"
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  // The modality tracker must see the key or pointer that comes before the input's focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const field = mergeFieldProps(
    {
      role: "textbox",
      labelable: true,
      disabled,
      readOnly,
      required: fieldProps.required === true,
      invalid: fieldProps.invalid === true,
      ...(fieldProps.name === undefined ? {} : { name: fieldProps.name }),
    },
    enclosing,
  )
  const api = colorFieldConnect({
    instance,
    value: current,
    draft: dirty ? view.context.draft : null,
    invalidDraft,
    format,
    alpha,
    field,
    focused,
    modality,
    ids: {
      input: partId("color-field", instance, "input"),
      hiddenInput: partId("color-field", instance, "hidden-input"),
    },
    form,
    defaultValue,
  })
  const state: ColorFieldState = {
    value: current,
    text: api.text,
    dirty,
    invalid: invalidDraft || field.invalid,
    disabled,
    readOnly,
  }
  // An owner's flush (a picker closing) commits a valid draft first.
  const registry = useContext(ColorFlushContext)
  useEffect(() => registry?.register(() => send({ type: "FLUSH" })), [registry, send])
  const ctx: FieldCtx = {
    instance,
    api,
    state,
    send,
    inputEl,
    hiddenEl,
    formInput,
    format,
    alpha,
    setFocused,
    invalidMessage: messages.invalid,
    value: current,
  }
  return (
    <FieldHost
      scope={COLOR_PICKER_SCOPE}
      rootPart={colorFieldPart("root")}
      id={instance}
      dir={dir}
      {...fieldProps}
      {...(fieldMessages ? { messages: fieldMessages } : {})}
      {...api.rootData}
    >
      <FieldContext value={ctx}>
        {children}
        <HiddenInput />
      </FieldContext>
    </FieldHost>
  )
}

/** The hidden input: name, `required`, validity, reset, autofill. */
function HiddenInput() {
  const ctx = useColorField("Root")
  const { send, formInput, hiddenEl } = ctx
  const latest = useRef(ctx.value)
  latest.current = ctx.value
  const [mirror] = useState(() => () => ({ value: colorFieldFormValue(latest.current) }))
  useIsoLayoutEffect(() => {
    formInput.sync(mirror(), { dispatch: false })
    // A committed text that is not a colour makes the field invalid (the Field's badInput).
    hiddenEl.current?.setCustomValidity(
      ctx.state.dirty && ctx.state.invalid ? ctx.invalidMessage : "",
    )
  })
  useEffect(
    () =>
      formInput.track({
        onReset: () => send({ type: "RESET" }),
        current: mirror,
        onNativeInput: (input) => {
          send({ type: "ADOPT", text: input.value })
          return true
        },
      }),
    [formInput, send, mirror],
  )
  return <input {...normalizeProps(ctx.api.hiddenInput())} ref={hiddenEl} />
}

/** The text input: free text until Enter, blur or a flush. */
function Input({
  render,
  ref,
  id,
  ...rest
}: Omit<ComponentPropsWithRef<"input">, "value" | "defaultValue"> & {
  /** Another element or a render function receiving the props and the field's state. */
  readonly render?: RenderProp<ColorFieldState>
}) {
  const ctx = useColorField("Input")
  const env = useEnvironment()
  const binding = useFieldControl()
  const controlId = id ?? binding?.controlId ?? ctx.api.input()["id"]
  const { send } = ctx
  const register = binding?.register
  useIsoLayoutEffect(() => {
    if (!register || typeof controlId !== "string") return
    return register(
      {
        id: controlId,
        labelable: true,
        focus: (m) => {
          if (ctx.inputEl.current) void focusSafely(ctx.inputEl.current, env, "programmatic", m)
        },
        validityElement: () => ctx.hiddenEl.current,
        value: () => ctx.value,
      },
      controlId,
    )
  }, [register, controlId, env])
  const latest = useRef(ctx)
  latest.current = ctx
  // The resulting text is checked before it applies (`beforeinput` is not React's onBeforeInput).
  useEffect(() => {
    const el = ctx.inputEl.current
    if (!el) return
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent
      const c = latest.current
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const pasted = ie.inputType === "insertFromPaste" || ie.inputType === "insertFromDrop"
      if (!ie.inputType.startsWith("insert") || ie.data === null) return
      const data = pasted ? ie.data.trim() : ie.data
      const next = el.value.slice(0, start) + data + el.value.slice(end)
      if (acceptColorText(next, c.format, c.alpha)) {
        if (pasted && data !== ie.data) {
          e.preventDefault()
          c.send({ type: "INPUT", text: next })
        }
        return
      }
      e.preventDefault()
    }
    el.addEventListener("beforeinput", onBeforeInput)
    return () => el.removeEventListener("beforeinput", onBeforeInput)
  }, [ctx.inputEl])
  const handlers = {
    // Devices that do not cancel `beforeinput` (Android composition): checked again here.
    onChange: (e: { currentTarget: HTMLInputElement }) => {
      const text = e.currentTarget.value
      if (acceptColorText(text, ctx.format, ctx.alpha)) send({ type: "INPUT", text })
      else e.currentTarget.value = ctx.api.text
    },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.defaultPrevented) return
      const event = colorFieldKeyEvent(describeKey(e.nativeEvent, env), ctx.state.dirty)
      if (!event) return
      // Escape reverts a dirty draft only: the layer around stays open (handled Escape).
      if (event.type === "ESCAPE") e.preventDefault()
      send(event)
    },
    onFocus: () => ctx.setFocused(true),
    onBlur: () => {
      ctx.setFocused(false)
      send({ type: "BLUR" })
    },
  }
  const own = normalizeProps({ ...ctx.api.input(), id: controlId })
  const props = mergeProps(
    { ...joinHandlers(own, handlers), ref: composeRefs(ctx.inputEl, ref) },
    rest,
  )
  return renderPart("input", props, render, ctx.state)
}

export const ColorField = {
  Root,
  Label: HostLabel,
  Description: HostDescription,
  ErrorMessage: HostErrorMessage,
  Input,
}

// --- Color Channel Field: a Number Input bound to one channel ---

export type ColorChannelFieldRootProps = Omit<
  NumberInputRootProps,
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "onValueCommit"
  | "min"
  | "max"
  | "step"
  | "largeStep"
  | "formatOptions"
  | "commitBehavior"
> & {
  readonly channel: ColorChannel
  readonly value?: ColorInput
  /** Default `hsb(0, 100%, 100%)`. */
  readonly defaultValue?: ColorInput
  readonly onValueChange?: (color: Color, details: ColorChangeDetails) => void
  readonly onValueCommit?: (color: Color, details: { readonly reason: string }) => void
  readonly colorSpace?: ColorSpace
}

const CHANNEL_DEFAULT = makeColor("hsb", [0, 100, 100])

/** A numeric input for one channel of a colour (a Number Input). */
function ChannelRoot({
  channel,
  value: valueProp,
  defaultValue: defaultProp,
  onValueChange,
  onValueCommit,
  colorSpace,
  style,
  children,
  ...rest
}: ColorChannelFieldRootProps) {
  const value = useColorProp(valueProp, "value", "color-channel-field")
  const defaultValue = useColorProp(defaultProp, "defaultValue", "color-channel-field")
  const [first] = useState(() => value ?? defaultValue)
  const space: ColorSpace =
    colorSpace ??
    (first && (channel === "alpha" || withChannel(first, channel, 0).space === first.space)
      ? first.space
      : channel === "red" || channel === "green" || channel === "blue"
        ? "rgb"
        : channel === "lightness"
          ? "hsl"
          : "hsb")
  const callbacks = useRef({ onValueChange, onValueCommit })
  callbacks.current = { onValueChange, onValueCommit }
  const machineProps = {
    value,
    defaultValue,
    space,
    fallback: CHANNEL_DEFAULT,
    onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) =>
      callbacks.current.onValueChange?.(c, {
        reason: (d.event as { reason?: string }).reason ?? d.reason,
        space,
        cancel: d.cancel,
      }),
    onValueCommit: (c: Color, d: { readonly reason: string }) =>
      callbacks.current.onValueCommit?.(c, d),
  }
  const { view, send } = useMachine(colorValueMachine, machineProps, {})
  const color = workingOf(machineProps, view.context, colorValueOf(machineProps, view.values.value))
  const latest = useRef({ color, memory: view.context.memory })
  latest.current = { color, memory: view.context.memory }
  const { "data-channel": dataChannel, ...numberProps } = colorChannelFieldProps(
    color,
    channel,
    view.context.memory,
  )
  const vars = normalizeProps({ style: colorVariables(color) }) as { style?: object }
  const messages = useMessages("color-field", colorFieldMessages)
  return (
    <ChannelContext value={messages.channelName(channel)}>
      <NumberInputNaming value={channelInputNaming}>
        <NumberInput.Root
          {...rest}
          {...numberProps}
          data-channel={dataChannel}
          style={{ ...vars.style, ...style }}
          // A colour always has every channel: an empty commit is refused (the text returns).
          onValueChange={(n) => {
            if (n === null) return
            send({
              type: "SET",
              color: withChannel(latest.current.color, channel, n, latest.current.memory),
              reason: "INPUT",
            })
          }}
          onValueCommit={(_n, d) => send({ type: "COMMIT", reason: String(d.reason) })}
        >
          {children}
        </NumberInput.Root>
      </NumberInputNaming>
    </ChannelContext>
  )
}

const ChannelContext = createContext("")

/** Named by the channel when there is no Label (a Label's `aria-labelledby` wins). */
function ChannelInput(props: ComponentPropsWithRef<typeof NumberInput.Input>) {
  const channelName = useContext(ChannelContext)
  return <NumberInput.Input aria-label={channelName} {...props} />
}

export const ColorChannelField = {
  Root: ChannelRoot,
  Label: NumberInput.Label,
  Description: NumberInput.Description,
  ErrorMessage: NumberInput.ErrorMessage,
  Control: NumberInput.Control,
  Input: ChannelInput,
  IncrementTrigger: NumberInput.IncrementTrigger,
  DecrementTrigger: NumberInput.DecrementTrigger,
}
