// Color Picker parts (design §8): the coordinator machine owns the colour, the format and the
// open state; the Popover is its controlled child (re-scoped to `color-picker`), and every
// colour child (Area, Slider, Field, Channel Field, Swatch Picker, Swatch) is the component of
// its own, bound to the picker's colour. Wiring only.

import {
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorFormat,
  type ColorInput,
  type ColorNameProp,
  type ColorPickerFormat,
  type ColorPickerMessages,
  type ColorPickerReason,
  type ColorSpace,
  colorPickerConnect,
  colorPickerMachine,
  colorPickerMessages,
  createFlushRegistry,
  focusAttrs,
  focusSafely,
  formatColor,
  isEyeDropperSupported,
  type MessageOverrides,
  nextFormat,
  PICKER_FORMATS,
  type PopoverProps,
  partId,
  pickerValueOf,
  pickerWorking,
  pickScreenColor,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { ColorArea, type ColorAreaRootProps } from "../color-area/color-area"
import { ColorChannelField, ColorField, ColorFlushContext } from "../color-field/color-field"
import { useColorProp } from "../color-input"
import { ColorSlider, type ColorSliderRootProps } from "../color-slider/color-slider"
import { ColorSwatch, TransparencyGrid as Grid, SwatchNaming } from "../color-swatch/color-swatch"
import {
  ColorSwatchPicker,
  type ColorSwatchPickerItemProps,
  type ColorSwatchPickerRootProps,
} from "../color-swatch-picker/color-swatch-picker"
import { FieldControlBoundary, useFieldControl } from "../field/field"
import { FieldHost, HostDescription, HostErrorMessage } from "../field/use-field-host"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Popover } from "../popover/popover"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    "color-picker": ColorPickerMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface ColorPickerState {
  readonly color: Color
  readonly format: ColorPickerFormat
  readonly open: boolean
  readonly inline: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

export interface ColorPickerChangeDetails extends ColorChangeDetails<ColorPickerReason> {
  /** The colour in the current format. */
  readonly valueAsString: string
  /** The channel an input or slider changed. */
  readonly channel?: string | undefined
}

type Send = ReturnType<typeof useMachine<typeof colorPickerMachine>>["send"]

interface Ctx {
  readonly instance: string
  readonly color: Color
  readonly format: ColorPickerFormat
  readonly state: ColorPickerState
  readonly send: Send
  readonly api: ReturnType<typeof colorPickerConnect>
  readonly messages: ColorPickerMessages
  readonly locale: string
  readonly dir: "ltr" | "rtl"
  readonly inline: boolean
  readonly colorName: ColorNameProp | undefined
  readonly registry: ReturnType<typeof createFlushRegistry>
  readonly setLabelRendered: (on: boolean) => void
  readonly setHiddenPart: (on: boolean) => void
  readonly hiddenPart: boolean
  readonly triggerEl: { current: HTMLElement | null }
  readonly formValue: string
}

const PickerContext = createContext<Ctx | null>(null)
function usePicker(part: string): Ctx {
  const ctx = useContext(PickerContext)
  if (!ctx) throw new Error(`ColorPicker.${part} must be inside ColorPicker.Root`)
  return ctx
}
/** Inside the Trigger: the ValueSwatch is decorative (the Trigger's name carries the colour). */
const InTriggerContext = createContext(false)

/** The default format of the first colour given: a hex string `hex`, otherwise its space. */
function firstFormat(input: ColorInput | undefined, color: Color | undefined): ColorPickerFormat {
  if (typeof input === "string" && input.trim().startsWith("#")) return "hex"
  return color ? color.space : "hex"
}

export type ColorPickerRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir" | "color"
> & {
  readonly children?: ReactNode
  readonly value?: ColorInput
  /** Default `#000000`. */
  readonly defaultValue?: ColorInput
  readonly onValueChange?: (color: Color, details: ColorPickerChangeDetails) => void
  readonly onValueCommit?: (color: Color, details: { readonly reason: ColorPickerReason }) => void
  readonly format?: ColorPickerFormat
  readonly defaultFormat?: ColorPickerFormat
  readonly onFormatChange?: (format: ColorPickerFormat) => void
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean, details: { readonly reason: string }) => void
  /** The content in place: no Popover, no layer, no positioning, no listeners. */
  readonly inline?: boolean
  readonly closeOnSelect?: boolean
  readonly modal?: boolean
  readonly positioning?: PopoverProps["positioning"]
  readonly initialFocus?: PopoverProps["initialFocus"]
  readonly persistentElements?: PopoverProps["persistentElements"]
  readonly name?: string
  readonly form?: string
  /** The submitted text's format (default the canonical hex). */
  readonly formFormat?: ColorFormat
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  readonly invalid?: boolean
  readonly colorName?: ColorNameProp
  readonly locale?: string
  readonly dir?: "ltr" | "rtl"
  readonly messages?: MessageOverrides<ColorPickerMessages>
}

/** A colour picker: a trigger and a popover (or an inline panel) bound to one colour. */
function Root({
  value: valueProp,
  defaultValue: defaultProp,
  onValueChange,
  onValueCommit,
  format: formatProp,
  defaultFormat,
  onFormatChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  inline = false,
  closeOnSelect = false,
  modal,
  positioning,
  initialFocus,
  persistentElements,
  name,
  form,
  formFormat,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  colorName,
  locale: ownLocale,
  dir: ownDir,
  messages: ownMessages,
  children,
  id,
  style,
  ...rest
}: ColorPickerRootProps) {
  const generated = useId()
  const instance = id ?? generated
  const { locale, dir } = useLocale(ownLocale, ownDir)
  const messages = useMessages("color-picker", colorPickerMessages, ownMessages)
  const value = useColorProp(valueProp, "value", "color-picker")
  const defaultValue = useColorProp(defaultProp, "defaultValue", "color-picker")
  const [initialFormat] = useState(
    () => defaultFormat ?? firstFormat(valueProp ?? defaultProp, value ?? defaultValue),
  )
  const callbacks = useRef({ onValueChange, onValueCommit, onFormatChange, onOpenChange })
  callbacks.current = { onValueChange, onValueCommit, onFormatChange, onOpenChange }
  const machineProps = {
    value,
    defaultValue,
    format: formatProp,
    defaultFormat: initialFormat,
    open: inline ? undefined : openProp,
    defaultOpen: defaultOpen ?? false,
    inline,
    disabled,
    readOnly,
    closeOnSelect,
    onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
      const e = d.event as { reason?: ColorPickerReason; channel?: string }
      const reason = e.reason ?? (d.reason === "RESET" ? "RESET" : "INPUT")
      callbacks.current.onValueChange?.(c, {
        reason,
        space: c.space,
        valueAsString: formatColor(c, latestFormat.current),
        channel: e.channel,
        cancel: d.cancel,
      })
    },
    onValueCommit: (c: Color, d: { readonly reason: ColorPickerReason }) =>
      callbacks.current.onValueCommit?.(c, d),
    onFormatChange: (f: ColorPickerFormat) => callbacks.current.onFormatChange?.(f),
    onOpenChange: (o: boolean, d: { reason: string; event: unknown }) => {
      const event = d.event as { type: string; reason?: string }
      // A transition's own reason ("select", "api") wins; else the Popover's, carried by the event.
      const reason = d.reason !== event.type ? d.reason : (event.reason ?? d.reason)
      callbacks.current.onOpenChange?.(o, { reason })
    },
  }
  const { view, send } = useMachine(colorPickerMachine, machineProps, {})
  const format = view.values.format
  const latestFormat = useRef(format)
  latestFormat.current = format
  const color = pickerWorking(machineProps, view.context, view.values.value)
  const emitted = pickerValueOf(machineProps, view.values.value)
  const open = view.values.open === true
  const [registry] = useState(() => createFlushRegistry())
  const [labelRendered, setLabelRendered] = useState(false)
  const [hiddenPart, setHiddenPart] = useState(false)
  const triggerEl = useRef<HTMLElement | null>(null)
  const ids = {
    control: partId("color-picker", instance, "control"),
    trigger: partId("color-picker", instance, "trigger"),
    label: partId("color-picker", instance, "label"),
    content: partId("color-picker", instance, "content"),
    hiddenInput: partId("color-picker", instance, "hidden-input"),
  }
  const api = colorPickerConnect({
    instance,
    color,
    format,
    open,
    inline,
    disabled,
    readOnly,
    invalid,
    dragging: false,
    messages,
    locale,
    colorName,
    ids,
    labelRendered,
    name,
    form,
    required,
    formFormat,
    defaultValue: defaultValue ?? pickerValueOf({ ...machineProps, value: undefined }, undefined),
  })
  const state: ColorPickerState = { color, format, open, inline, disabled, readOnly }
  const ctx: Ctx = {
    instance,
    color,
    format,
    state,
    send,
    api,
    messages,
    locale,
    dir,
    inline,
    colorName,
    registry,
    setLabelRendered,
    setHiddenPart,
    hiddenPart,
    triggerEl,
    formValue: api.formValue,
  }
  void emitted
  const rootProps = normalizeProps(api.root()) as { style?: object } & Record<string, unknown>
  const body = (
    <PickerContext value={ctx}>
      {children}
      {hiddenPart ? null : <AutoHiddenInput />}
    </PickerContext>
  )
  return (
    <FieldHost
      scope="color-picker"
      id={instance}
      dir={dir}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      invalid={invalid}
      {...rest}
      {...rootProps}
      style={{ ...rootProps.style, ...style }}
    >
      {inline ? (
        body
      ) : (
        <Popover.Root
          id={instance}
          scope="color-picker"
          open={open}
          onOpenChange={(next, d) => {
            if (next) {
              send({ type: "OPEN", reason: d.reason })
              return
            }
            // Every pending draft commits first (react-spectrum#9748), then the close.
            registry.flushAll()
            send({ type: "CLOSE", reason: d.reason })
          }}
          disabled={disabled}
          {...(modal === undefined ? {} : { modal })}
          {...(positioning === undefined ? {} : { positioning })}
          {...(initialFocus === undefined ? {} : { initialFocus })}
          {...(persistentElements === undefined ? {} : { persistentElements })}
        >
          {body}
        </Popover.Root>
      )}
    </FieldHost>
  )
}

/** The hidden input the Root renders unless a HiddenInput part is placed. */
function AutoHiddenInput() {
  const ctx = usePicker("HiddenInput")
  return <HiddenField ctx={ctx} />
}

function HiddenField({ ctx }: { readonly ctx: Ctx }) {
  const el = useRef<HTMLInputElement | null>(null)
  const { send } = ctx
  const latest = useRef(ctx.formValue)
  latest.current = ctx.formValue
  // The value property mirrors the colour after every commit (hidden-form-input); a reset
  // restores the default; a native change we did not make (autofill) is adopted.
  useIsoLayoutEffect(() => {
    if (el.current && el.current.value !== latest.current) el.current.value = latest.current
  })
  useEffect(() => {
    const input = el.current
    const owner = input?.form
    const onReset = () => send({ type: "RESET" })
    const onChange = (e: Event) => {
      if (e.isTrusted) send({ type: "ADOPT", text: (e.target as HTMLInputElement).value })
    }
    owner?.addEventListener("reset", onReset)
    input?.addEventListener("change", onChange)
    return () => {
      owner?.removeEventListener("reset", onReset)
      input?.removeEventListener("change", onChange)
    }
  }, [send])
  return <input {...normalizeProps(ctx.api.hiddenInput())} ref={el} />
}

/** Places the hidden input (it replaces the automatic one). */
function HiddenInput() {
  const ctx = usePicker("HiddenInput")
  const { setHiddenPart } = ctx
  useIsoLayoutEffect(() => {
    setHiddenPart(true)
    return () => setHiddenPart(false)
  }, [setHiddenPart])
  return <HiddenField ctx={ctx} />
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<ColorPickerState>
}

/** Names the Control, the Trigger and the content; a press focuses the Trigger. */
function Label({ render, ...rest }: Own<"label">) {
  const ctx = usePicker("Label")
  const env = useEnvironment()
  const { setLabelRendered } = ctx
  useIsoLayoutEffect(() => {
    setLabelRendered(true)
    return () => setLabelRendered(false)
  }, [setLabelRendered])
  const props = mergeProps(
    joinHandlers(normalizeProps(ctx.api.label()), {
      onMouseDown: (e: { preventDefault(): void }) => {
        // A pointer press focuses the Trigger (inline: the first text input) without a ring.
        e.preventDefault()
        const target =
          ctx.triggerEl.current ??
          document.getElementById(ctx.api.inlineContent()["id"] as string)?.querySelector("input")
        if (target) void focusSafely(target as HTMLElement, env, "programmatic", "pointer")
      },
    }),
    rest,
  )
  return renderPart("label", props, render, ctx.state)
}

/** `role="group"`: the Popover's anchor. */
function Control({ render, ...rest }: Own<"div">) {
  const ctx = usePicker("Control")
  const props = mergeProps(normalizeProps(ctx.api.control()), rest)
  if (ctx.inline) return renderPart("div", props, render, ctx.state)
  // The Popover finds its anchor by the anchor's own id: an `id` here would replace it and the
  // content would never be positioned.
  const { id: _anchorOwnsTheId, ...anchorProps } = props
  return <Popover.Anchor {...(anchorProps as object)} />
}

/** Opens the content; named "Choose color, <colour>" and by the Label. */
function Trigger({ render, ref, children, ...rest }: Own<"button">) {
  const ctx = usePicker("Trigger")
  const env = useEnvironment()
  const binding = useFieldControl()
  const register = binding?.register
  const triggerId = ctx.api.trigger()["aria-labelledby"]?.toString().split(" ")[0] ?? ""
  useIsoLayoutEffect(() => {
    if (!register || !triggerId) return
    return register(
      {
        id: triggerId,
        labelable: true,
        focus: (m) => {
          if (ctx.triggerEl.current) void focusSafely(ctx.triggerEl.current, env, "programmatic", m)
        },
        validityElement: () => null,
        value: () => ctx.formValue,
      },
      triggerId,
    )
  }, [register, triggerId, env])
  useEffect(() => {
    if (ctx.inline && process.env.NODE_ENV !== "production") {
      console.warn("[rind-ui] color-picker: an inline picker has no Trigger; it renders nothing")
    }
  }, [ctx.inline])
  if (ctx.inline) return null
  const own = normalizeProps(ctx.api.trigger())
  return (
    <InTriggerContext value={true}>
      <Popover.Trigger
        {...(mergeProps(own, rest) as object)}
        // The trigger renders a button: a button ref is an element ref.
        ref={composeRefs(ctx.triggerEl, ref) as React.Ref<HTMLButtonElement>}
        {...(render ? { render: render as never } : {})}
      >
        {children}
      </Popover.Trigger>
    </InTriggerContext>
  )
}

function Portal(props: ComponentPropsWithRef<typeof Popover.Portal>) {
  const ctx = usePicker("Portal")
  if (ctx.inline) return <>{props.children}</>
  return <Popover.Portal {...props} />
}

function Positioner(props: ComponentPropsWithRef<typeof Popover.Positioner>) {
  const ctx = usePicker("Positioner")
  if (ctx.inline) return <>{props.children}</>
  return <Popover.Positioner {...props} />
}

/** The content: the Popover's, or (inline) a `role="group"` in place. Children are embedded. */
function Content({
  render,
  children,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...rest
}: Own<"div">) {
  const ctx = usePicker("Content")
  const name = ctx.api.contentName({ label, labelledBy })
  const body = (
    <ColorFlushContext value={ctx.registry}>
      <FieldControlBoundary>{children}</FieldControlBoundary>
    </ColorFlushContext>
  )
  if (ctx.inline) {
    const props = mergeProps(
      {
        ...normalizeProps(ctx.api.inlineContent()),
        "aria-label": name.label,
        "aria-labelledby": name.labelledBy,
      },
      { ...rest, children: body },
    )
    return renderPart("div", props, render, ctx.state)
  }
  return (
    <Popover.Content
      {...(rest as object)}
      {...(name.label === undefined ? {} : { "aria-label": name.label })}
      {...(name.labelledBy === undefined ? {} : { "aria-labelledby": name.labelledBy })}
      {...(render ? { render: render as never } : {})}
    >
      {body}
    </Popover.Content>
  )
}

/** The picker's Color Area. */
/** ColorPicker.Area's props: the area's own props without a value (the picker owns it). */
export type ColorPickerAreaProps = Omit<ColorAreaRootProps, "value" | "defaultValue">

function Area({ children, ...rest }: ColorPickerAreaProps) {
  const ctx = usePicker("Area")
  if ("value" in rest && process.env.NODE_ENV !== "production") {
    console.error("[rind-ui] color-picker: a bound ColorPicker.Area takes no `value` of its own")
  }
  const m = ctx.messages
  return (
    <ColorArea.Root
      colorSpace="hsb"
      {...rest}
      value={ctx.color}
      disabled={ctx.state.disabled}
      readOnly={ctx.state.readOnly}
      dir={ctx.dir}
      locale={ctx.locale}
      {...(ctx.colorName === undefined ? {} : { colorName: ctx.colorName })}
      messages={{ ...m, valueText: m.areaValueText }}
      onValueChange={(c) => ctx.send({ type: "COLOR.SET", color: c, reason: "AREA" })}
      onValueCommit={() => ctx.send({ type: "COLOR.COMMIT", reason: "AREA" })}
    >
      {children}
    </ColorArea.Root>
  )
}

/** The picker's Color Slider for `channel`. */
/** ColorPicker.ChannelSlider's props: `channel` and the slider's own props, without a value. */
export type ColorPickerChannelSliderProps = Omit<ColorSliderRootProps, "value" | "defaultValue">

function ChannelSlider({ children, ...rest }: ColorPickerChannelSliderProps) {
  const ctx = usePicker("ChannelSlider")
  const m = ctx.messages
  return (
    <ColorSlider.Root
      {...rest}
      value={ctx.color}
      disabled={ctx.state.disabled}
      readOnly={ctx.state.readOnly}
      dir={ctx.dir}
      locale={ctx.locale}
      {...(ctx.colorName === undefined ? {} : { colorName: ctx.colorName })}
      messages={{ ...m, valueText: m.sliderValueText }}
      onValueChange={(c) =>
        ctx.send({ type: "COLOR.SET", color: c, reason: "SLIDER", channel: rest.channel })
      }
      onValueCommit={() => ctx.send({ type: "COLOR.COMMIT", reason: "SLIDER" })}
    >
      {children}
    </ColorSlider.Root>
  )
}

export type ColorPickerChannelInputProps = Omit<ComponentPropsWithRef<"input">, "value"> & {
  /** A colour channel (a Color Channel Field), or `hex` / `css` (a Color Field). */
  readonly channel: ColorChannel | "hex" | "css"
  /** Accept and show 8-digit hex (default: when the colour has alpha below 1). */
  readonly alpha?: boolean
}

/** A Color Field (`hex`, `css`) or a Color Channel Field, bound to the picker. */
function ChannelInput({
  channel,
  alpha,
  "aria-label": ariaLabel,
  ...rest
}: ColorPickerChannelInputProps) {
  const ctx = usePicker("ChannelInput")
  const m = ctx.messages
  if (channel === "hex" || channel === "css") {
    return (
      <ColorField.Root
        value={ctx.color}
        format={channel}
        alpha={alpha ?? ctx.color.alpha < 1}
        disabled={ctx.state.disabled}
        readOnly={ctx.state.readOnly}
        messages={m}
        onValueChange={(c) => {
          if (!c) return
          ctx.send({ type: "COLOR.SET", color: c, reason: "INPUT", channel })
          ctx.send({ type: "COLOR.COMMIT", reason: "INPUT" })
        }}
      >
        <ColorField.Input aria-label={ariaLabel ?? m.formatName(channel)} {...rest} />
      </ColorField.Root>
    )
  }
  return (
    <ColorChannelField.Root
      channel={channel}
      value={ctx.color}
      disabled={ctx.state.disabled}
      readOnly={ctx.state.readOnly}
      locale={ctx.locale}
      onValueChange={(c) => ctx.send({ type: "COLOR.SET", color: c, reason: "INPUT", channel })}
      onValueCommit={() => ctx.send({ type: "COLOR.COMMIT", reason: "INPUT" })}
    >
      <ColorChannelField.Input
        aria-label={ariaLabel ?? m.channelName(channel)}
        {...(rest as object)}
      />
    </ColorChannelField.Root>
  )
}

/** ColorPicker.SwatchGroup's props: the swatch group's own props, without a value. */
export type ColorPickerSwatchGroupProps = Omit<ColorSwatchPickerRootProps, "value" | "defaultValue">

/** The picker's swatches (a Color Swatch Picker bound to its colour). */
function SwatchGroup({ children, ...rest }: ColorPickerSwatchGroupProps) {
  const ctx = usePicker("SwatchGroup")
  return (
    <ColorSwatchPicker.Root
      {...rest}
      value={ctx.color}
      disabled={ctx.state.disabled}
      readOnly={ctx.state.readOnly}
      messages={ctx.messages}
      onValueChange={(c) => {
        ctx.send({ type: "COLOR.SET", color: c, reason: "SWATCH" })
        ctx.send({ type: "COLOR.COMMIT", reason: "SWATCH" })
      }}
    >
      {children}
    </ColorSwatchPicker.Root>
  )
}

/** ColorPicker.SwatchTrigger's props: one swatch of the group (`value`, `disabled`). */
export type ColorPickerSwatchTriggerProps = ColorSwatchPickerItemProps

function SwatchTrigger(props: ColorPickerSwatchTriggerProps) {
  usePicker("SwatchTrigger")
  return <ColorSwatchPicker.Item {...props} />
}

/** A Color Swatch. */
const SWATCH = { scope: "color-picker", part: "swatch" } as const
const VALUE_SWATCH = { scope: "color-picker", part: "value-swatch" } as const

/** ColorPicker.Swatch's props: a colour to show (`color`), named by its colour name. */
export type ColorPickerSwatchProps = ComponentPropsWithRef<typeof ColorSwatch.Root>

function Swatch(props: ColorPickerSwatchProps) {
  const ctx = usePicker("Swatch")
  return (
    <SwatchNaming value={SWATCH}>
      <ColorSwatch.Root messages={ctx.messages} {...props} />
    </SwatchNaming>
  )
}

/** The picker's colour as a swatch (decorative inside the Trigger). */
function ValueSwatch(props: Omit<ComponentPropsWithRef<typeof ColorSwatch.Root>, "color">) {
  const ctx = usePicker("ValueSwatch")
  const inTrigger = useContext(InTriggerContext)
  if (inTrigger) {
    return (
      <SwatchNaming value={VALUE_SWATCH}>
        <ColorSwatch.Root
          color={ctx.color}
          messages={ctx.messages}
          aria-hidden="true"
          role="presentation"
          {...props}
        />
      </SwatchNaming>
    )
  }
  return (
    <SwatchNaming value={VALUE_SWATCH}>
      <ColorSwatch.Root color={ctx.color} messages={ctx.messages} {...props} />
    </SwatchNaming>
  )
}

/** The colour in the current format. Not a live region. */
function ValueText({ render, children, ...rest }: Own<"span">) {
  const ctx = usePicker("ValueText")
  const props = mergeProps(normalizeProps(ctx.api.valueTextPart()), rest)
  return renderPart(
    "span",
    { ...props, children: children ?? ctx.api.valueText },
    render,
    ctx.state,
  )
}

/** Opens the browser's eye dropper; hidden where there is none (ark#2764). */
function EyeDropperTrigger({ render, children, ...rest }: Own<"button">) {
  const ctx = usePicker("EyeDropperTrigger")
  const env = useEnvironment()
  const [supported, setSupported] = useState(false)
  const focus = useFocusAttrs()
  // After mount: the server and the first client render agree (hidden).
  useEffect(() => setSupported(isEyeDropperSupported(globalThis.window)), [])
  const props = mergeProps(
    joinHandlers(
      { ...normalizeProps(ctx.api.eyeDropperTrigger(supported)), ...focus },
      {
        onClick: async () => {
          const hex = await pickScreenColor(globalThis.window)
          if (!hex) return
          ctx.send({ type: "EYEDROPPER.RESULT", hex })
          env.announcer.announce({
            message: ctx.messages.picked({ colorName: ctx.api.colorName }),
            priority: "polite",
            key: `color-picker-${ctx.instance}`,
            lang: ctx.locale,
          })
        },
      },
    ),
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

/** A native select of the formats. */
/** `data-focus` / `data-focus-visible` for a picker-owned control, with its focus handlers. */
function useFocusAttrs() {
  const env = useEnvironment()
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  return {
    ...focusAttrs(focused, modality),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  }
}

function FormatSelect({ render, ...rest }: Own<"select">) {
  const ctx = usePicker("FormatSelect")
  const el = useRef<HTMLSelectElement | null>(null)
  const focus = useFocusAttrs()
  // The value is set as a property (a controlled select would warn).
  useIsoLayoutEffect(() => {
    if (el.current) el.current.value = ctx.format
  })
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.formatSelect()), {
        onChange: (e: { currentTarget: HTMLSelectElement }) =>
          ctx.send({ type: "FORMAT.SET", format: e.currentTarget.value as ColorPickerFormat }),
      }),
      ...focus,
      ref: el,
      defaultValue: ctx.format,
    },
    rest,
  )
  return renderPart(
    "select",
    {
      ...props,
      children: PICKER_FORMATS.map((f) => (
        <option key={f} value={f}>
          {ctx.messages.formatOptions(f)}
        </option>
      )),
    },
    render,
    ctx.state,
  )
}

/** Cycles hex → rgb → hsl → hsb and announces the new format. */
function FormatTrigger({ render, children, ...rest }: Own<"button">) {
  const ctx = usePicker("FormatTrigger")
  const env = useEnvironment()
  const next = nextFormat(ctx.format)
  const focus = useFocusAttrs()
  const props = mergeProps(
    joinHandlers(
      {
        ...focus,
        "data-scope": "color-picker",
        "data-part": "format-trigger",
        "data-instance": ctx.instance,
        type: "button",
        "aria-label": ctx.messages.formatTrigger({
          current: ctx.messages.formatOptions(ctx.format),
          next: ctx.messages.formatOptions(next),
        }),
        disabled: ctx.state.disabled || undefined,
      },
      {
        onClick: () => {
          ctx.send({ type: "FORMAT.SET", format: next })
          env.announcer.announce({
            message: ctx.messages.formatChanged({ format: ctx.messages.formatOptions(next) }),
            priority: "polite",
            key: `color-picker-format-${ctx.instance}`,
            lang: ctx.locale,
          })
        },
      },
    ),
    rest,
  )
  return renderPart(
    "button",
    { ...props, children: children ?? ctx.messages.formatOptions(ctx.format) },
    render,
    ctx.state,
  )
}

/** Renders its children only while the picker's format is `format`. */
function View({
  format,
  render,
  children,
  ...rest
}: Own<"div"> & { readonly format: ColorPickerFormat }) {
  const ctx = usePicker("View")
  if (ctx.format !== format) return null
  const props = mergeProps(normalizeProps(ctx.api.view(format)), rest)
  return renderPart("div", { ...props, children }, render, ctx.state)
}

function TransparencyGrid(props: ComponentPropsWithRef<typeof Grid>) {
  usePicker("TransparencyGrid")
  return <Grid scope="color-picker" {...props} />
}

export const ColorPicker = {
  Root,
  Label,
  Control,
  Trigger,
  Portal,
  Positioner,
  Content,
  Area,
  AreaBackground: ColorArea.Background,
  AreaThumb: ColorArea.Thumb,
  ChannelSlider,
  ChannelSliderLabel: ColorSlider.Label,
  ChannelSliderValueText: ColorSlider.ValueText,
  ChannelSliderTrack: ColorSlider.Track,
  ChannelSliderThumb: ColorSlider.Thumb,
  ChannelInput,
  EyeDropperTrigger,
  SwatchGroup,
  SwatchTrigger,
  SwatchIndicator: ColorSwatchPicker.Indicator,
  Swatch,
  ValueSwatch,
  FormatSelect,
  FormatTrigger,
  View,
  ValueText,
  HiddenInput,
  TransparencyGrid,
  Description: HostDescription,
  ErrorMessage: HostErrorMessage,
}

export type { ColorSpace }
