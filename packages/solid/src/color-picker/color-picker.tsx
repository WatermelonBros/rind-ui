/** @jsxImportSource solid-js */
// Color Picker parts (design §8): the coordinator machine owns the colour, the format and the
// open state; the Popover is its controlled child (re-scoped to `color-picker`), and every
// colour child (Area, Slider, Field, Channel Field, Swatch Picker, Swatch) is the component of
// its own, bound to the picker's colour. Wiring only.
import {
  announcerCapability,
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorFormat,
  type ColorInput,
  type ColorNameProp,
  type ColorPickerFormat,
  type ColorPickerMessages,
  type ColorPickerReason,
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { ColorArea, type ColorAreaRootProps } from "../color-area/color-area"
import { ColorChannelField, ColorField, ColorFlushContext } from "../color-field/color-field"
import { useColorProp } from "../color-input"
import { ColorSlider, type ColorSliderRootProps } from "../color-slider/color-slider"
import {
  ColorSwatch,
  type ColorSwatchProps,
  TransparencyGrid as Grid,
  SwatchNamingContext,
} from "../color-swatch/color-swatch"
import {
  ColorSwatchPicker,
  type ColorSwatchPickerItemProps,
  type ColorSwatchPickerRootProps,
} from "../color-swatch-picker/color-swatch-picker"
import { FieldControlBoundary, useFieldControl } from "../field/context"
import { FieldHost, HostDescription, HostErrorMessage } from "../field/field-host"
import { afterMount } from "../lifecycle"
import { composeRefs, joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { ScopedPopoverRoot } from "../popover/popover"
import * as Popover from "../popover/popover.parts"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    "color-picker": ColorPickerMessages
  }
}

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
  readonly instance: Accessor<string>
  readonly color: Accessor<Color>
  readonly format: Accessor<ColorPickerFormat>
  readonly state: ColorPickerState
  readonly send: Send
  readonly api: Accessor<ReturnType<typeof colorPickerConnect>>
  readonly messages: Accessor<ColorPickerMessages>
  readonly locale: Accessor<string>
  readonly dir: Accessor<"ltr" | "rtl">
  readonly inline: boolean
  readonly colorName: Accessor<ColorNameProp | undefined>
  readonly registry: ReturnType<typeof createFlushRegistry>
  readonly setLabelRendered: (on: boolean) => void
  readonly setHiddenPart: (on: boolean) => void
  readonly hiddenPart: Accessor<boolean>
  readonly triggerEl: Accessor<Element | null>
  readonly setTriggerEl: (el: Element | null) => void
  readonly formValue: Accessor<string>
}

const PickerContext = createContext<Ctx>()
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
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onChange" | "dir" | "color" | "id"
> & {
  readonly id?: string | undefined
  /** The picker parts. */
  readonly children?: JSX.Element
  readonly value?: ColorInput | null | undefined
  /** Default `#000000`. */
  readonly defaultValue?: ColorInput | null | undefined
  readonly onValueChange?: ((color: Color, details: ColorPickerChangeDetails) => void) | undefined
  readonly onValueCommit?:
    | ((color: Color, details: { readonly reason: ColorPickerReason }) => void)
    | undefined
  readonly format?: ColorPickerFormat | undefined
  readonly defaultFormat?: ColorPickerFormat | undefined
  readonly onFormatChange?: ((format: ColorPickerFormat) => void) | undefined
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: { readonly reason: string }) => void)
    | undefined
  /** The content in place: no Popover, no layer, no positioning, no listeners. */
  readonly inline?: boolean | undefined
  readonly closeOnSelect?: boolean | undefined
  readonly modal?: boolean | undefined
  /** The Popover's positioning: side, align, offsets, flip, shift, size, arrow and mode. */
  readonly positioning?: PopoverProps["positioning"]
  /** Where focus goes once the Popover is placed: a function, or the overlay's rule. */
  readonly initialFocus?: PopoverProps["initialFocus"]
  /** Elements whose presses and focus count as inside the Popover (a toast region). */
  readonly persistentElements?: PopoverProps["persistentElements"]
  readonly name?: string | undefined
  /** The id of the form the hidden input belongs to. */
  readonly form?: string | undefined
  /** The submitted text's format (default the canonical hex). */
  readonly formFormat?: ColorFormat | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  /** Marks the picker required (Field state, `data-required` on the hidden input). */
  readonly required?: boolean | undefined
  /** Marks the picker invalid (`data-invalid`, the Field's error state). */
  readonly invalid?: boolean | undefined
  /** A fixed name or a function replacing the computed colour name (Trigger label, value texts, announcements). */
  readonly colorName?: ColorNameProp | undefined
  /** Formats the colour name and the numbers. Default: the provider's. */
  readonly locale?: string | undefined
  /** Reading direction; mirrors the area and sliders. Default: the provider's. */
  readonly dir?: "ltr" | "rtl" | undefined
  readonly messages?: MessageOverrides<ColorPickerMessages> | undefined
}

/** A colour picker: a trigger and a popover (or an inline panel) bound to one colour. */
function Root(props: ColorPickerRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "onValueCommit",
    "format",
    "defaultFormat",
    "onFormatChange",
    "open",
    "defaultOpen",
    "onOpenChange",
    "inline",
    "closeOnSelect",
    "modal",
    "positioning",
    "initialFocus",
    "persistentElements",
    "name",
    "form",
    "formFormat",
    "disabled",
    "readOnly",
    "required",
    "invalid",
    "colorName",
    "locale",
    "dir",
    "messages",
    "children",
    "id",
  ])
  const instance = useRootId(() => local.id)
  const loc = useLocale(
    () => local.locale,
    () => local.dir,
  )
  const messages = useMessages("color-picker", colorPickerMessages, () => local.messages)
  const value = useColorProp(() => local.value, "value", "color-picker")
  const defaultValue = useColorProp(() => local.defaultValue, "defaultValue", "color-picker")
  // Decided once: the content is the Popover's, or in place.
  const inline = untrack(() => local.inline === true)
  const disabled = () => local.disabled === true
  const readOnly = () => local.readOnly === true
  const initialFormat = untrack(
    () =>
      local.defaultFormat ??
      firstFormat(local.value ?? local.defaultValue ?? undefined, value() ?? defaultValue()),
  )
  let latestFormat: ColorPickerFormat = initialFormat
  const machineProps = createMemo(
    () =>
      ({
        value: value(),
        defaultValue: defaultValue(),
        format: local.format,
        defaultFormat: initialFormat,
        open: inline ? undefined : local.open,
        defaultOpen: local.defaultOpen ?? false,
        inline,
        disabled: disabled(),
        readOnly: readOnly(),
        closeOnSelect: local.closeOnSelect ?? false,
        onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
          const e = d.event as { reason?: ColorPickerReason; channel?: string }
          const reason = e.reason ?? (d.reason === "RESET" ? "RESET" : "INPUT")
          local.onValueChange?.(c, {
            reason,
            space: c.space,
            valueAsString: formatColor(c, latestFormat),
            channel: e.channel,
            cancel: d.cancel,
          } as ColorPickerChangeDetails)
        },
        onValueCommit: (c: Color, d: { readonly reason: ColorPickerReason }) =>
          local.onValueCommit?.(c, d),
        onFormatChange: (f: ColorPickerFormat) => local.onFormatChange?.(f),
        onOpenChange: (o: boolean, d: { reason: string; event: unknown }) => {
          const event = d.event as { type: string; reason?: string }
          // A transition's own reason ("select", "api") wins; else the Popover's, carried by the event.
          const reason = d.reason !== event.type ? d.reason : (event.reason ?? d.reason)
          local.onOpenChange?.(o, { reason })
        },
      }) as never,
  )
  const { view, send } = useMachine(colorPickerMachine, machineProps, {})
  const format = () => view().values.format as ColorPickerFormat
  createEffect(() => {
    latestFormat = format()
  })
  const color = createMemo(
    () => pickerWorking(machineProps(), view().context, view().values.value) as Color,
  )
  const open = () => view().values.open === true
  const registry = createFlushRegistry()
  const [labelRendered, setLabelRendered] = createSignal(false)
  const [hiddenPart, setHiddenPart] = createSignal(false)
  const [triggerEl, setTriggerEl] = createSignal<Element | null>(null)
  const api = createMemo(() => {
    const id = instance()
    return colorPickerConnect({
      instance: id,
      color: color(),
      format: format(),
      open: open(),
      inline,
      disabled: disabled(),
      readOnly: readOnly(),
      invalid: local.invalid === true,
      dragging: false,
      messages: messages(),
      locale: loc().locale,
      colorName: local.colorName,
      ids: {
        control: partId("color-picker", id, "control"),
        trigger: partId("color-picker", id, "trigger"),
        label: partId("color-picker", id, "label"),
        content: partId("color-picker", id, "content"),
        hiddenInput: partId("color-picker", id, "hidden-input"),
      },
      labelRendered: labelRendered(),
      name: local.name,
      form: local.form,
      required: local.required === true,
      formFormat: local.formFormat,
      defaultValue:
        defaultValue() ??
        pickerValueOf(
          { ...(machineProps() as Record<string, unknown>), value: undefined } as never,
          undefined,
        ),
    })
  })
  const state = reactive<ColorPickerState>(() => ({
    color: color(),
    format: format(),
    open: open(),
    inline,
    disabled: disabled(),
    readOnly: readOnly(),
  }))
  const ctx: Ctx = {
    instance,
    color,
    format,
    state,
    send,
    api,
    messages,
    locale: () => loc().locale,
    dir: () => loc().dir,
    inline,
    colorName: () => local.colorName,
    registry,
    setLabelRendered,
    setHiddenPart,
    hiddenPart,
    triggerEl,
    setTriggerEl,
    formValue: () => api().formValue,
  }
  const attrs = createMemo(() => {
    const root = normalizeProps(api().root())
    return root as Record<string, unknown>
  })
  const body = () => (
    <PickerContext.Provider value={ctx}>
      {local.children}
      <Show when={!hiddenPart()}>
        <HiddenField />
      </Show>
    </PickerContext.Provider>
  )
  return (
    <FieldHost
      {...rest}
      scope="color-picker"
      id={instance()}
      dir={loc().dir}
      disabled={disabled()}
      readOnly={readOnly()}
      required={local.required === true}
      invalid={local.invalid === true}
      attrs={attrs}
    >
      {inline ? (
        body()
      ) : (
        <ScopedPopoverRoot
          id={instance()}
          scope="color-picker"
          open={open()}
          onOpenChange={(next, d) => {
            if (next) {
              send({ type: "OPEN", reason: d.reason } as never)
              return
            }
            // Every pending draft commits first (react-spectrum#9748), then the close.
            registry.flushAll()
            send({ type: "CLOSE", reason: d.reason } as never)
          }}
          disabled={disabled()}
          modal={local.modal}
          positioning={local.positioning}
          initialFocus={local.initialFocus}
          persistentElements={local.persistentElements}
        >
          {body()}
        </ScopedPopoverRoot>
      )}
    </FieldHost>
  )
}

/** The hidden input: the Root renders it unless a HiddenInput part is placed. */
function HiddenField() {
  const ctx = usePicker("HiddenInput")
  const [el, setEl] = createSignal<HTMLInputElement | null>(null)
  // The value property mirrors the colour after every commit (hidden-form-input); a reset
  // restores the default; a native change we did not make (autofill) is adopted.
  afterMount(() => {
    createEffect(() => {
      const input = el()
      const value = ctx.formValue()
      if (input && input.value !== value) input.value = value
    })
    const input = untrack(el)
    const owner = input?.form
    const onReset = () => ctx.send({ type: "RESET" })
    const onChange = (e: Event) => {
      if (e.isTrusted) ctx.send({ type: "ADOPT", text: (e.target as HTMLInputElement).value })
    }
    owner?.addEventListener("reset", onReset)
    input?.addEventListener("change", onChange)
    onCleanup(() => {
      owner?.removeEventListener("reset", onReset)
      input?.removeEventListener("change", onChange)
    })
  })
  const props = createMemo(() => normalizeProps(ctx.api().hiddenInput()))
  return <input {...props()} ref={setEl} />
}

/** Places the hidden input (it replaces the automatic one). */
function HiddenInput() {
  const ctx = usePicker("HiddenInput")
  afterMount(() => {
    ctx.setHiddenPart(true)
    onCleanup(() => ctx.setHiddenPart(false))
  })
  return <HiddenField />
}

type Own<A, S = ColorPickerState> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the picker's state. */
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

/** Names the Control, the Trigger and the content; a press focuses the Trigger. */
function Label(props: Own<JSX.LabelHTMLAttributes<HTMLLabelElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePicker("Label")
  const env = useEnvironment()
  afterMount(() => {
    ctx.setLabelRendered(true)
    onCleanup(() => ctx.setLabelRendered(false))
  })
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().label()), {
        onMouseDown: (e: MouseEvent) => {
          // A pointer press focuses the Trigger (inline: the first text input) without a ring.
          e.preventDefault()
          const target =
            untrack(ctx.triggerEl) ??
            document
              .getElementById(untrack(ctx.api).inlineContent()["id"] as string)
              ?.querySelector("input")
          if (target) void focusSafely(target as HTMLElement, env, "programmatic", "pointer")
        },
      }),
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: the consumer's content or props name the control
    <label {...p}>{children()}</label>
  ))
}

/** `role="group"`: the Popover's anchor. */
function Control(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePicker("Control")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().control()), rest))
  const children = () => local.children
  if (ctx.inline) {
    return renderPart(local.render, merged, ctx.state, children, (p) => (
      <div {...p}>{children()}</div>
    ))
  }
  // The Popover finds its anchor by the anchor's own id: an `id` here would replace it and the
  // content would never be positioned.
  const anchorProps = createMemo(() => {
    const { id: _anchorOwnsTheId, ...props } = merged()
    void _anchorOwnsTheId
    return props
  })
  return <Popover.Anchor {...anchorProps()}>{local.children}</Popover.Anchor>
}

/** Opens the content; named "Choose color, <colour>" and by the Label. */
function Trigger(props: Parameters<typeof Popover.Trigger>[0]) {
  const [local, rest] = splitProps(props, ["render", "ref", "children"])
  const ctx = usePicker("Trigger")
  const env = useEnvironment()
  const binding = useFieldControl()
  const triggerId = createMemo(
    () => ctx.api().trigger()["aria-labelledby"]?.toString().split(" ")[0] ?? "",
  )
  afterMount(() => {
    if (binding) {
      createEffect(() => {
        const id = triggerId()
        if (!id) return
        onCleanup(
          untrack(() =>
            binding().register(
              {
                id,
                labelable: true,
                focus: (m) => {
                  const el = untrack(ctx.triggerEl)
                  if (el) void focusSafely(el as HTMLElement, env, "programmatic", m)
                },
                validityElement: () => null,
                value: () => untrack(ctx.formValue),
              },
              id,
            ),
          ),
        )
      })
    }
    if (ctx.inline && process.env.NODE_ENV !== "production") {
      console.warn("[rind-ui] color-picker: an inline picker has no Trigger; it renders nothing")
    }
  })
  if (ctx.inline) return null
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().trigger()), rest))
  return (
    <InTriggerContext.Provider value={true}>
      <Popover.Trigger
        {...merged()}
        // The trigger renders a button: a button ref is an element ref.
        ref={composeRefs(ctx.setTriggerEl, local.ref)}
        render={local.render as never}
      >
        {local.children}
      </Popover.Trigger>
    </InTriggerContext.Provider>
  )
}

function Portal(props: Parameters<typeof Popover.Portal>[0]) {
  const ctx = usePicker("Portal")
  return ctx.inline ? props.children : <Popover.Portal {...props} />
}

function Positioner(props: Parameters<typeof Popover.Positioner>[0]) {
  const ctx = usePicker("Positioner")
  return ctx.inline ? props.children : <Popover.Positioner {...props} />
}

/** The content: the Popover's, or (inline) a `role="group"` in place. Children are embedded. */
function Content(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children", "aria-label", "aria-labelledby"])
  const ctx = usePicker("Content")
  const name = createMemo(() =>
    ctx.api().contentName({ label: local["aria-label"], labelledBy: local["aria-labelledby"] }),
  )
  const body = () => (
    <ColorFlushContext.Provider value={ctx.registry}>
      <FieldControlBoundary>{local.children}</FieldControlBoundary>
    </ColorFlushContext.Provider>
  )
  if (ctx.inline) {
    const merged = createMemo(() =>
      mergeProps(
        {
          ...normalizeProps(ctx.api().inlineContent()),
          "aria-label": name().label,
          "aria-labelledby": name().labelledBy,
        },
        rest,
      ),
    )
    return renderPart(local.render, merged, ctx.state, body, (p) => <div {...p}>{body()}</div>)
  }
  return (
    <Popover.Content
      {...rest}
      aria-label={name().label}
      aria-labelledby={name().labelledBy}
      render={local.render as never}
    >
      {body()}
    </Popover.Content>
  )
}

/** ColorPicker.Area's props: the area's own props without a value (the picker owns it). */
export type ColorPickerAreaProps = Omit<ColorAreaRootProps, "value" | "defaultValue">

/** The picker's Color Area. */
function Area(props: ColorPickerAreaProps) {
  const ctx = usePicker("Area")
  if ("value" in props && process.env.NODE_ENV !== "production") {
    console.error("[rind-ui] color-picker: a bound ColorPicker.Area takes no `value` of its own")
  }
  const messages = createMemo(() => ({
    ...ctx.messages(),
    valueText: ctx.messages().areaValueText,
  }))
  return (
    <ColorArea.Root
      colorSpace="hsb"
      {...props}
      value={ctx.color()}
      disabled={ctx.state.disabled}
      readOnly={ctx.state.readOnly}
      dir={ctx.dir()}
      locale={ctx.locale()}
      colorName={ctx.colorName()}
      messages={messages() as never}
      onValueChange={(c) => ctx.send({ type: "COLOR.SET", color: c, reason: "AREA" })}
      onValueCommit={() => ctx.send({ type: "COLOR.COMMIT", reason: "AREA" })}
    />
  )
}

/** ColorPicker.ChannelSlider's props: `channel` and the slider's own props, without a value. */
export type ColorPickerChannelSliderProps = Omit<ColorSliderRootProps, "value" | "defaultValue">

/** The picker's Color Slider for `channel`. */
function ChannelSlider(props: ColorPickerChannelSliderProps) {
  const ctx = usePicker("ChannelSlider")
  const messages = createMemo(() => ({
    ...ctx.messages(),
    valueText: ctx.messages().sliderValueText,
  }))
  return (
    <ColorSlider.Root
      {...props}
      value={ctx.color()}
      disabled={ctx.state.disabled}
      readOnly={ctx.state.readOnly}
      dir={ctx.dir()}
      locale={ctx.locale()}
      colorName={ctx.colorName()}
      messages={messages() as never}
      onValueChange={(c) =>
        ctx.send({ type: "COLOR.SET", color: c, reason: "SLIDER", channel: props.channel })
      }
      onValueCommit={() => ctx.send({ type: "COLOR.COMMIT", reason: "SLIDER" })}
    />
  )
}

export type ColorPickerChannelInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "value"
> & {
  /** A colour channel (a Color Channel Field), or `hex` / `css` (a Color Field). */
  readonly channel: ColorChannel | "hex" | "css"
  /** Accept and show 8-digit hex (default: when the colour has alpha below 1). */
  readonly alpha?: boolean | undefined
}

/** A Color Field (`hex`, `css`) or a Color Channel Field, bound to the picker. */
function ChannelInput(props: ColorPickerChannelInputProps) {
  const [local, rest] = splitProps(props, ["channel", "alpha", "aria-label"])
  const ctx = usePicker("ChannelInput")
  const text = createMemo(() => local.channel === "hex" || local.channel === "css")
  return (
    <Show
      when={text()}
      fallback={
        <ColorChannelField.Root
          channel={local.channel as ColorChannel}
          value={ctx.color()}
          disabled={ctx.state.disabled}
          readOnly={ctx.state.readOnly}
          locale={ctx.locale()}
          onValueChange={(c) =>
            ctx.send({ type: "COLOR.SET", color: c, reason: "INPUT", channel: local.channel })
          }
          onValueCommit={() => ctx.send({ type: "COLOR.COMMIT", reason: "INPUT" })}
        >
          <ColorChannelField.Input
            aria-label={
              local["aria-label"] ?? ctx.messages().channelName(local.channel as ColorChannel)
            }
            {...(rest as object)}
          />
        </ColorChannelField.Root>
      }
    >
      <ColorField.Root
        value={ctx.color()}
        format={local.channel as "hex" | "css"}
        alpha={local.alpha ?? ctx.color().alpha < 1}
        disabled={ctx.state.disabled}
        readOnly={ctx.state.readOnly}
        messages={ctx.messages() as never}
        onValueChange={(c) => {
          if (!c) return
          ctx.send({ type: "COLOR.SET", color: c, reason: "INPUT", channel: local.channel })
          ctx.send({ type: "COLOR.COMMIT", reason: "INPUT" })
        }}
      >
        <ColorField.Input
          aria-label={local["aria-label"] ?? ctx.messages().formatName(local.channel as "hex")}
          {...rest}
        />
      </ColorField.Root>
    </Show>
  )
}

/** ColorPicker.SwatchGroup's props: the swatch group's own props, without a value. */
export type ColorPickerSwatchGroupProps = Omit<ColorSwatchPickerRootProps, "value" | "defaultValue">

/** The picker's swatches (a Color Swatch Picker bound to its colour). */
function SwatchGroup(props: ColorPickerSwatchGroupProps) {
  const ctx = usePicker("SwatchGroup")
  return (
    <ColorSwatchPicker.Root
      {...props}
      value={ctx.color()}
      disabled={ctx.state.disabled}
      readOnly={ctx.state.readOnly}
      messages={ctx.messages() as never}
      onValueChange={(c) => {
        ctx.send({ type: "COLOR.SET", color: c, reason: "SWATCH" })
        ctx.send({ type: "COLOR.COMMIT", reason: "SWATCH" })
      }}
    />
  )
}

/** ColorPicker.SwatchTrigger's props: one swatch of the group (`value`, `disabled`). */
export type ColorPickerSwatchTriggerProps = ColorSwatchPickerItemProps

function SwatchTrigger(props: ColorPickerSwatchTriggerProps) {
  usePicker("SwatchTrigger")
  return <ColorSwatchPicker.Item {...props} />
}

const SWATCH = { scope: "color-picker", part: "swatch" } as const
const VALUE_SWATCH = { scope: "color-picker", part: "value-swatch" } as const

/** ColorPicker.Swatch's props: a colour to show (`color`), named by its colour name. */
export type ColorPickerSwatchProps = ColorSwatchProps

/** A Color Swatch. */
function Swatch(props: ColorPickerSwatchProps) {
  const ctx = usePicker("Swatch")
  return (
    <SwatchNamingContext.Provider value={SWATCH}>
      <ColorSwatch.Root messages={ctx.messages() as never} {...props} />
    </SwatchNamingContext.Provider>
  )
}

/** The picker's colour as a swatch (decorative inside the Trigger). */
function ValueSwatch(props: Omit<ColorSwatchProps, "color">) {
  const ctx = usePicker("ValueSwatch")
  const inTrigger = useContext(InTriggerContext)
  return (
    <SwatchNamingContext.Provider value={VALUE_SWATCH}>
      {inTrigger ? (
        <ColorSwatch.Root
          color={ctx.color()}
          messages={ctx.messages() as never}
          aria-hidden="true"
          role="presentation"
          {...props}
        />
      ) : (
        <ColorSwatch.Root color={ctx.color()} messages={ctx.messages() as never} {...props} />
      )}
    </SwatchNamingContext.Provider>
  )
}

/** The colour in the current format. Not a live region. */
function ValueText(props: Own<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePicker("ValueText")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().valueTextPart()), rest))
  const children = () => local.children ?? ctx.api().valueText
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** `data-focus` / `data-focus-visible` for a picker-owned control, with its focus handlers. */
function useFocusAttrs() {
  const env = useEnvironment()
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  return createMemo(() => ({
    ...focusAttrs(focused(), modality()),
    onFocusIn: () => setFocused(true),
    onFocusOut: () => setFocused(false),
  }))
}

/** Opens the browser's eye dropper; hidden where there is none (ark#2764). */
function EyeDropperTrigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePicker("EyeDropperTrigger")
  const env = useEnvironment(announcerCapability)
  const [supported, setSupported] = createSignal(false)
  const focus = useFocusAttrs()
  // After mount: the server and the first client render agree (hidden).
  afterMount(() => setSupported(isEyeDropperSupported(globalThis.window)))
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(
        { ...normalizeProps(ctx.api().eyeDropperTrigger(supported())), ...focus() },
        {
          onClick: async () => {
            const hex = await pickScreenColor(globalThis.window)
            if (!hex) return
            ctx.send({ type: "EYEDROPPER.RESULT", hex })
            env.announcer.announce({
              message: ctx.messages().picked({ colorName: untrack(ctx.api).colorName }),
              priority: "polite",
              key: `color-picker-${untrack(ctx.instance)}`,
              lang: untrack(ctx.locale),
            })
          },
        },
      ),
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** A native select of the formats. */
function FormatSelect(props: Own<JSX.SelectHTMLAttributes<HTMLSelectElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePicker("FormatSelect")
  const [el, setEl] = createSignal<HTMLSelectElement | null>(null)
  const focus = useFocusAttrs()
  // The value is set as a property (a controlled select would warn).
  createEffect(() => {
    const select = el()
    const format = ctx.format()
    if (select) select.value = format
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().formatSelect()), {
          onChange: (e: Event) =>
            ctx.send({
              type: "FORMAT.SET",
              format: (e.currentTarget as HTMLSelectElement).value as ColorPickerFormat,
            }),
        }),
        ...focus(),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => (
    <For each={PICKER_FORMATS}>
      {(f) => (
        // The `selected` attribute marks the format the markup starts with (the value itself is
        // the property the effect above sets).
        <option value={f} {...{ "attr:selected": f === untrack(ctx.format) ? "" : undefined }}>
          {ctx.messages().formatOptions(f)}
        </option>
      )}
    </For>
  )
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <select {...p}>{children()}</select>
  ))
}

/** Cycles hex → rgb → hsl → hsb and announces the new format. */
function FormatTrigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePicker("FormatTrigger")
  const env = useEnvironment(announcerCapability)
  const next = () => nextFormat(ctx.format())
  const focus = useFocusAttrs()
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(
        {
          ...focus(),
          "data-scope": "color-picker",
          "data-part": "format-trigger",
          "data-instance": ctx.instance(),
          type: "button",
          "aria-label": ctx.messages().formatTrigger({
            current: ctx.messages().formatOptions(ctx.format()),
            next: ctx.messages().formatOptions(next()),
          }),
          disabled: ctx.state.disabled || undefined,
        },
        {
          onClick: () => {
            const to = untrack(next)
            ctx.send({ type: "FORMAT.SET", format: to })
            env.announcer.announce({
              message: untrack(ctx.messages).formatChanged({
                format: untrack(ctx.messages).formatOptions(to),
              }),
              priority: "polite",
              key: `color-picker-format-${untrack(ctx.instance)}`,
              lang: untrack(ctx.locale),
            })
          },
        },
      ),
      rest,
    ),
  )
  const children = () => local.children ?? ctx.messages().formatOptions(ctx.format())
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** Renders its children only while the picker's format is `format`. */
function View(
  props: Own<JSX.HTMLAttributes<HTMLDivElement>> & {
    /** The format this view is for: the children render only while it is the picker's. */
    readonly format: ColorPickerFormat
  },
) {
  const [local, rest] = splitProps(props, ["format", "render", "children"])
  const ctx = usePicker("View")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().view(local.format)), rest))
  const children = () => local.children
  return (
    <Show when={ctx.format() === local.format}>
      {untrack(() =>
        renderPart(local.render, merged, ctx.state, children, (p) => (
          <div {...p}>{children()}</div>
        )),
      )}
    </Show>
  )
}

function TransparencyGrid(props: Omit<Parameters<typeof Grid>[0], "scope">) {
  usePicker("TransparencyGrid")
  // The picker's scope last: a consumer prop never moves the part out of it.
  return <Grid {...props} scope="color-picker" />
}

const AreaBackground = ColorArea.Background
const AreaThumb = ColorArea.Thumb
const ChannelSliderLabel = ColorSlider.Label
const ChannelSliderValueText = ColorSlider.ValueText
const ChannelSliderTrack = ColorSlider.Track
const ChannelSliderThumb = ColorSlider.Thumb
const SwatchIndicator = ColorSwatchPicker.Indicator
const Description = HostDescription
const ErrorMessage = HostErrorMessage

/** The parts, by name: `color-picker.parts.ts` re-exports them as the `ColorPicker` namespace. */
export {
  Area,
  AreaBackground,
  AreaThumb,
  ChannelInput,
  ChannelSlider,
  ChannelSliderLabel,
  ChannelSliderThumb,
  ChannelSliderTrack,
  ChannelSliderValueText,
  Content,
  Control,
  Description,
  ErrorMessage,
  EyeDropperTrigger,
  FormatSelect,
  FormatTrigger,
  HiddenInput,
  Label,
  Portal,
  Positioner,
  Root,
  Swatch,
  SwatchGroup,
  SwatchIndicator,
  SwatchTrigger,
  TransparencyGrid,
  Trigger,
  ValueSwatch,
  ValueText,
  View,
}
