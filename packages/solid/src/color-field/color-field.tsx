/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useColorProp } from "../color-input"
import { useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { NumberInputNamingContext, type NumberInputRootProps } from "../number-input/number-input"
import * as NumberInput from "../number-input/number-input.parts"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "color-field": ColorFieldMessages
  }
}

/** The flush registry an owner (the Color Picker) provides: each field registers its `flush`. */
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
  readonly api: Accessor<ReturnType<typeof colorFieldConnect>>
  readonly state: ColorFieldState
  readonly send: ReturnType<typeof useMachine<typeof colorFieldMachine>>["send"]
  readonly inputEl: Accessor<Element | null>
  readonly setInputEl: (el: Element | null) => void
  readonly hiddenEl: Accessor<Element | null>
  readonly setHiddenEl: (el: Element | null) => void
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly format: Accessor<ColorFieldFormat>
  readonly alpha: Accessor<boolean>
  readonly setFocused: (on: boolean) => void
  readonly invalidMessage: Accessor<string>
  readonly value: Accessor<Color | null>
}
const FieldContext = createContext<FieldCtx>()
function useColorField(part: string): FieldCtx {
  const ctx = useContext(FieldContext)
  if (!ctx) throw new Error(`ColorField.${part} must be inside ColorField.Root`)
  return ctx
}

export type ColorFieldRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onChange" | "dir" | "color" | "id"
> & {
  readonly id?: string | undefined
  /** The field's parts (Label, Input, Description, ErrorMessage). */
  readonly children?: JSX.Element
  readonly value?: ColorInput | null | undefined
  /** Default `null` (no colour). */
  readonly defaultValue?: ColorInput | null | undefined
  readonly onValueChange?:
    | ((
        color: Color | null,
        details: ColorChangeDetails<ColorFieldReason> & { readonly modality?: string | undefined },
      ) => void)
    | undefined
  /** Every accepted edit of the text (the value changes only at commit points). */
  readonly onInputValueChange?: ((text: string) => void) | undefined
  /** `hex` (default): hex digits with an optional `#`; `css`: any CSS colour. */
  readonly format?: ColorFieldFormat | undefined
  /** Accept and show 8-digit hex (default false: the alpha never changes). */
  readonly alpha?: boolean | undefined
  readonly colorSpace?: ColorSpace | undefined
  readonly name?: string | undefined
  /** The id of the form the hidden input belongs to. */
  readonly form?: string | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly required?: boolean | undefined
  /** Marks the field invalid whatever the text (`aria-invalid`, `data-invalid`). */
  readonly invalid?: boolean | undefined
  /** Sets the direction when `dir` is not given. Default: the provider's. */
  readonly locale?: string | undefined
  /** Reading direction of the root. Default: the locale's, else the provider's. */
  readonly dir?: "ltr" | "rtl" | undefined
  readonly messages?: MessageOverrides<ColorFieldMessages> | undefined
  /** The Field's messages when the Root is the Field. */
  readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
}

const reasonOf = (r: string): ColorFieldReason =>
  r === "RESET" ? "RESET" : r === "ADOPT" ? "ADOPT" : "INPUT.COMMIT"
const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)

/** A text input for a whole colour: hex by default, any CSS colour with `format="css"`. */
function Root(props: ColorFieldRootProps) {
  const [local, fieldProps] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "onInputValueChange",
    "format",
    "alpha",
    "colorSpace",
    "form",
    "locale",
    "dir",
    "messages",
    "fieldMessages",
    "children",
    "id",
  ])
  const env = useEnvironment()
  const instance = useRootId(() => local.id)
  const loc = useLocale(
    () => local.locale,
    () => local.dir,
  )
  const messages = useMessages("color-field", colorFieldMessages, () => local.messages)
  const parsedValue = useColorProp(() => local.value ?? undefined, "value", "color-field")
  const parsedDefault = useColorProp(
    () => local.defaultValue ?? undefined,
    "defaultValue",
    "color-field",
  )
  const format = () => local.format ?? "hex"
  const alpha = () => local.alpha === true
  const value = () => (local.value === null ? null : parsedValue())
  const defaultValue = () => (local.defaultValue === null ? null : (parsedDefault() ?? null))
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled = () =>
    fieldProps.disabled === true || enclosing?.().state.disabled === true || fieldsetDisabled()
  const readOnly = () => fieldProps.readOnly === true || enclosing?.().state.readOnly === true
  const [inputEl, setInputEl] = createSignal<Element | null>(null)
  const [hiddenEl, setHiddenEl] = createSignal<Element | null>(null)
  const formInput = hiddenFormInput(
    { input: () => asInput(hiddenEl()), control: () => asInput(inputEl()) },
    env,
  )
  const { view, send } = useMachine(
    colorFieldMachine,
    createMemo(() => ({
      value: value(),
      defaultValue: defaultValue(),
      format: format(),
      alpha: alpha(),
      colorSpace: local.colorSpace,
      disabled: disabled(),
      readOnly: readOnly(),
      onValueChange: (c: Color | null, d: { reason: string; cancel(): void }) => {
        // Uncontrolled: the form value is current before an implicit submission reads it.
        if (untrack(() => local.value) === undefined) {
          formInput.sync({ value: colorFieldFormValue(c) }, { dispatch: false })
        }
        local.onValueChange?.(c, {
          reason: reasonOf(d.reason),
          space: c?.space ?? local.colorSpace ?? "rgb",
          cancel: d.cancel,
        } as never)
      },
      onInputValueChange: (t: string) => local.onInputValueChange?.(t),
    })),
    {},
  )
  const dirty = () => view().state !== "idle"
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  // The modality tracker must see the key or pointer that comes before the input's focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const field = createMemo(() =>
    mergeFieldProps(
      {
        role: "textbox",
        labelable: true,
        disabled: disabled(),
        readOnly: readOnly(),
        required: fieldProps.required === true,
        invalid: fieldProps.invalid === true,
        ...(fieldProps.name === undefined ? {} : { name: fieldProps.name }),
      },
      enclosing?.() ?? null,
    ),
  )
  const current = createMemo(() =>
    colorFieldValue(
      { value: value(), defaultValue: defaultValue(), format: format(), alpha: alpha() },
      view().values.value,
    ),
  )
  const api = createMemo(() =>
    colorFieldConnect({
      instance: instance(),
      value: current(),
      draft: dirty() ? view().context.draft : null,
      invalidDraft: view().state === "invalid",
      format: format(),
      alpha: alpha(),
      field: field(),
      focused: focused(),
      modality: modality(),
      ids: {
        input: partId("color-field", instance(), "input"),
        hiddenInput: partId("color-field", instance(), "hidden-input"),
      },
      form: local.form,
      defaultValue: defaultValue(),
    }),
  )
  const state = reactive<ColorFieldState>(() => ({
    value: current(),
    text: api().text,
    dirty: dirty(),
    invalid: view().state === "invalid" || field().invalid,
    disabled: disabled(),
    readOnly: readOnly(),
  }))
  // An owner's flush (a picker closing) commits a valid draft first.
  const registry = useContext(ColorFlushContext)
  afterMount(() => {
    if (registry) onCleanup(registry.register(() => send({ type: "FLUSH" })))
  })
  const ctx: FieldCtx = {
    api,
    state,
    send,
    inputEl,
    setInputEl,
    hiddenEl,
    setHiddenEl,
    formInput,
    format,
    alpha,
    setFocused,
    invalidMessage: () => messages().invalid,
    value: current,
  }
  return (
    <FieldHost
      {...fieldProps}
      scope={COLOR_PICKER_SCOPE}
      rootPart={colorFieldPart("root")}
      id={instance()}
      dir={loc().dir}
      messages={local.fieldMessages}
      attrs={() => api().rootData as Record<string, unknown>}
    >
      <FieldContext.Provider value={ctx}>
        {local.children}
        <HiddenInput />
      </FieldContext.Provider>
    </FieldHost>
  )
}

/** The hidden input: name, `required`, validity, reset, autofill. */
function HiddenInput() {
  const ctx = useColorField("Root")
  const mirror = () => ({ value: colorFieldFormValue(ctx.value()) })
  afterMount(() => {
    createEffect(() => {
      ctx.hiddenEl()
      ctx.formInput.sync(mirror(), { dispatch: false })
      // A committed text that is not a colour makes the field invalid (the Field's badInput).
      asInput(ctx.hiddenEl())?.setCustomValidity(
        ctx.state.dirty && ctx.state.invalid ? ctx.invalidMessage() : "",
      )
    })
    onCleanup(
      ctx.formInput.track({
        onReset: () => ctx.send({ type: "RESET" }),
        current: () => untrack(mirror),
        onNativeInput: (input) => {
          ctx.send({ type: "ADOPT", text: input.value })
          return true
        },
      }),
    )
  })
  const props = createMemo(() => normalizeProps(ctx.api().hiddenInput()))
  return <input {...props()} ref={ctx.setHiddenEl} />
}

/** The text input: free text until Enter, blur or a flush. */
function Input(
  props: Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "value" | "children"> & {
    /** Another element: a function receiving the props to spread and the field's state. */
    readonly render?: RenderProp<ColorFieldState> | undefined
  },
) {
  const [local, rest] = splitProps(props, ["render", "id"])
  const ctx = useColorField("Input")
  const env = useEnvironment()
  const binding = useFieldControl()
  // A memo: the binding changes on every registration, the id (compared by value) does not.
  const controlId = createMemo(
    () => local.id ?? binding?.().controlId ?? (ctx.api().input()["id"] as string),
  )
  if (binding) {
    afterMount(() => {
      createEffect(() => {
        const id = controlId()
        onCleanup(
          untrack(() =>
            binding().register(
              {
                id,
                labelable: true,
                focus: (m) => {
                  const el = asInput(ctx.inputEl())
                  if (el) void focusSafely(el, env, "programmatic", m)
                },
                validityElement: () => asInput(ctx.hiddenEl()),
                value: () => untrack(ctx.value),
              },
              id,
            ),
          ),
        )
      })
    })
  }
  // The resulting text is checked before it applies.
  afterMount(() => {
    createEffect(() => {
      const el = asInput(ctx.inputEl())
      if (!el) return
      const onBeforeInput = (e: Event) => {
        const ie = e as InputEvent
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? el.value.length
        const pasted = ie.inputType === "insertFromPaste" || ie.inputType === "insertFromDrop"
        if (!ie.inputType.startsWith("insert") || ie.data === null) return
        const data = pasted ? ie.data.trim() : ie.data
        const next = el.value.slice(0, start) + data + el.value.slice(end)
        if (acceptColorText(next, untrack(ctx.format), untrack(ctx.alpha))) {
          if (pasted && data !== ie.data) {
            e.preventDefault()
            ctx.send({ type: "INPUT", text: next })
          }
          return
        }
        e.preventDefault()
      }
      el.addEventListener("beforeinput", onBeforeInput)
      onCleanup(() => el.removeEventListener("beforeinput", onBeforeInput))
    })
  })
  const handlers = {
    // Devices that do not cancel `beforeinput` (Android composition): checked again here.
    onInput: (e: InputEvent) => {
      const el = e.currentTarget as HTMLInputElement
      const text = el.value
      if (acceptColorText(text, untrack(ctx.format), untrack(ctx.alpha)))
        ctx.send({ type: "INPUT", text })
      else el.value = untrack(ctx.api).text
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const event = colorFieldKeyEvent(describeKey(e, env), ctx.state.dirty)
      if (!event) return
      // Escape reverts a dirty draft only: the layer around stays open (handled Escape).
      if (event.type === "ESCAPE") e.preventDefault()
      ctx.send(event)
    },
    onFocusIn: () => ctx.setFocused(true),
    onFocusOut: () => {
      ctx.setFocused(false)
      ctx.send({ type: "BLUR" })
    },
  }
  const merged = createMemo(() => {
    const own = normalizeProps({ ...ctx.api().input(), id: controlId() })
    // The input shows the draft: the `value` attribute follows it (controlled text).
    if (typeof own["value"] === "string") own["attr:value"] = own["value"]
    return mergeProps({ ...joinHandlers(own, handlers), ref: ctx.setInputEl }, rest)
  })
  return renderPart(
    local.render,
    merged,
    ctx.state,
    () => undefined,
    (p) => <input {...p} />,
  )
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
  readonly value?: ColorInput | null | undefined
  /** Default `hsb(0, 100%, 100%)`. */
  readonly defaultValue?: ColorInput | null | undefined
  readonly onValueChange?: ((color: Color, details: ColorChangeDetails) => void) | undefined
  readonly onValueCommit?:
    | ((color: Color, details: { readonly reason: string }) => void)
    | undefined
  readonly colorSpace?: ColorSpace | undefined
}

const CHANNEL_DEFAULT = makeColor("hsb", [0, 100, 100])
const ChannelContext = createContext<Accessor<string>>(() => "")

/** A numeric input for one channel of a colour (a Number Input). */
function ChannelRoot(props: ColorChannelFieldRootProps) {
  const [local, rest] = splitProps(props, [
    "channel",
    "value",
    "defaultValue",
    "onValueChange",
    "onValueCommit",
    "colorSpace",
    "children",
  ])
  const value = useColorProp(() => local.value, "value", "color-channel-field")
  const defaultValue = useColorProp(() => local.defaultValue, "defaultValue", "color-channel-field")
  const space: ColorSpace = untrack(() => {
    const first = value() ?? defaultValue()
    const channel = local.channel
    return (
      local.colorSpace ??
      (first && (channel === "alpha" || withChannel(first, channel, 0).space === first.space)
        ? first.space
        : channel === "red" || channel === "green" || channel === "blue"
          ? "rgb"
          : channel === "lightness"
            ? "hsl"
            : "hsb")
    )
  })
  const machineProps = createMemo(() => ({
    value: value(),
    defaultValue: defaultValue(),
    space,
    fallback: CHANNEL_DEFAULT,
    onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) =>
      local.onValueChange?.(c, {
        reason: (d.event as { reason?: string }).reason ?? d.reason,
        space,
        cancel: d.cancel,
      } as ColorChangeDetails),
    onValueCommit: (c: Color, d: { readonly reason: string }) => local.onValueCommit?.(c, d),
  }))
  const { view, send } = useMachine(colorValueMachine, machineProps, {})
  const color = createMemo(() =>
    workingOf(machineProps(), view().context, colorValueOf(machineProps(), view().values.value)),
  )
  const numberProps = createMemo(() =>
    colorChannelFieldProps(color(), local.channel, view().context.memory),
  )
  const messages = useMessages("color-field", colorFieldMessages)
  const merged = createMemo(() => {
    const vars = normalizeProps({ style: colorVariables(color()) }) as { style?: object }
    return mergeProps({ ...numberProps(), style: vars.style }, rest)
  })
  return (
    <ChannelContext.Provider value={() => messages().channelName(local.channel)}>
      <NumberInputNamingContext.Provider value={channelInputNaming}>
        <NumberInput.Root
          {...merged()}
          // A colour always has every channel: an empty commit is refused (the text returns).
          onValueChange={(n) => {
            if (n === null) return
            send({
              type: "SET",
              color: withChannel(untrack(color), local.channel, n, untrack(view).context.memory),
              reason: "INPUT",
            })
          }}
          onValueCommit={(_n, d) => send({ type: "COMMIT", reason: String(d.reason) })}
        >
          {local.children}
        </NumberInput.Root>
      </NumberInputNamingContext.Provider>
    </ChannelContext.Provider>
  )
}

/** Named by the channel when there is no Label (a Label's `aria-labelledby` wins). */
function ChannelInput(props: Parameters<typeof NumberInput.Input>[0]) {
  const channelName = useContext(ChannelContext)
  return <NumberInput.Input aria-label={channelName()} {...props} />
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
