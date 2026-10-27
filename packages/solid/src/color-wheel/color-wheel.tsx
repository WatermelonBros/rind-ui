/** @jsxImportSource solid-js */
// Color Wheel (add-color-wheel): a hue ring. No machine of its own: the parts run the Angle Slider
// machine on the colour's hue and map each new hue back to a colour in the working space. A
// visually hidden range input is the one focusable slider; a hidden input submits the hex.
import {
  type AngleSliderEvent,
  type AngleSliderReason,
  angleSliderKeyEvent,
  angleSliderMachine,
  type ChangeDetails,
  type Color,
  type ColorInput,
  type ColorMemory,
  type ColorWheelMessages,
  colorWheelConnect,
  colorWheelMessages,
  colorWithHue,
  describeKey,
  focusSafely,
  hiddenFormInput,
  hueOf,
  isDragPress,
  type MessageOverrides,
  type Modality,
  makeColor,
  onRing,
  partId,
  pointerAngleSession,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useColorProp } from "../color-input"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "color-wheel": ColorWheelMessages
  }
}

/** What every part's `render` receives. */
export interface ColorWheelRenderState {
  readonly color: Color
  /** The hue in degrees, [0, 360). */
  readonly hue: number
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Api = ReturnType<typeof colorWheelConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly send: (event: AngleSliderEvent) => void
  readonly state: ColorWheelRenderState
  readonly registry: PartRegistry<"label">
  readonly labelId: Accessor<string>
  readonly press: (track: Element, e: PointerEvent) => void
  readonly setThumb: (el: Element | null) => void
  readonly setInput: (el: HTMLInputElement | null) => void
  readonly setHidden: (el: HTMLInputElement | null) => void
  readonly setFocused: (focused: boolean) => void
}
const ColorWheelContext = createContext<Ctx>()
function useColorWheel(part: string): Ctx {
  const ctx = useContext(ColorWheelContext)
  if (!ctx) throw new Error(`ColorWheel.${part} must be inside ColorWheel.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<ColorWheelRenderState> | undefined
  readonly children?: JSX.Element | ((state: ColorWheelRenderState) => JSX.Element)
}

export type ColorWheelRootProps = Omit<
  PartProps<JSX.HTMLAttributes<HTMLDivElement>>,
  "onChange"
> & {
  /** Controlled colour. */
  readonly value?: ColorInput | undefined
  /** Uncontrolled colour. Default `hsl(0 100% 50%)`. */
  readonly defaultValue?: ColorInput | undefined
  /** Every change of the hue. */
  readonly onValueChange?:
    | ((value: Color, details: ChangeDetails<AngleSliderEvent>) => void)
    | undefined
  /** Once per interaction: a drag's release, a press, a key. */
  readonly onValueCommit?:
    | ((value: Color, details: { readonly reason: AngleSliderReason }) => void)
    | undefined
  /** The space the colour is emitted in. Default `hsl`. */
  readonly colorSpace?: "hsl" | "hsb" | undefined
  /** Degrees per step. Default 1. */
  readonly step?: number | undefined
  /** Shift+Arrow, PageUp and PageDown. Default 15. */
  readonly largeStep?: number | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly invalid?: boolean | undefined
  /** Submits the colour as hex. */
  readonly name?: string | undefined
  /** The form's id, when outside it. */
  readonly form?: string | undefined
  readonly messages?: MessageOverrides<ColorWheelMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}

const DEFAULT = makeColor("hsl", [0, 100, 50])
/** The ring's width when the Track sets no `--rind-color-wheel-thickness`. */
const THICKNESS = 30

function Root(props: ColorWheelRootProps) {
  const [own, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "onValueCommit",
    "colorSpace",
    "step",
    "largeStep",
    "disabled",
    "readOnly",
    "invalid",
    "name",
    "form",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment()
  const messages = useMessages("color-wheel", colorWheelMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const value = useColorProp(() => own.value, "value", "color-wheel")
  const defaultValue = useColorProp(() => own.defaultValue, "defaultValue", "color-wheel")
  const registry = usePartRegistry<"label">({ scope: "color-wheel", root: instance() })
  const rendered = useRenderedId(registry, "label")
  const labelId = createMemo(() => partId("color-wheel", instance(), "label"))
  const step = () => (own.step !== undefined && own.step > 0 ? own.step : 1)
  // The uncontrolled colour; a controlled `value` wins.
  const [inner, setInner] = createSignal<Color>(untrack(defaultValue) ?? DEFAULT)
  const color = () => value() ?? inner()
  // A grey keeps the hue it was given.
  const [memory, setMemory] = createSignal<ColorMemory>({})
  const [focused, setFocused] = createSignal(false)
  let inputEl: HTMLInputElement | null = null
  let hiddenEl: HTMLInputElement | null = null
  let thumbEl: Element | null = null
  const drag = pointerAngleSession()
  const modality = useModality(env.modality, focused)
  // The last hue changed to: a commit follows it in the same interaction, before the props do.
  let latest: number | null = null
  const withHue = (hue: number) =>
    colorWithHue(untrack(color), hue, own.colorSpace, untrack(memory))
  const machineProps = createMemo(() => ({
    value: hueOf(color(), step(), memory()),
    step: step(),
    wrap: true,
    largeStep: own.largeStep,
    disabled: own.disabled === true,
    readOnly: own.readOnly === true,
    onValueChange: (hue: number, d: ChangeDetails<AngleSliderEvent>) => {
      latest = hue
      const next = withHue(hue)
      setMemory((m) => ({ ...m, hue }))
      if (untrack(value) === undefined) setInner(next)
      own.onValueChange?.(next, d)
    },
    onValueCommit: (hue: number, d: { readonly reason: AngleSliderReason }) =>
      own.onValueCommit?.(withHue(latest ?? hue), d),
  }))
  const { view, send } = useMachine(angleSliderMachine, machineProps, {
    drag,
    focusInput: (m: Modality) => {
      if (inputEl) void focusSafely(inputEl, env, "programmatic", m)
    },
  })
  const dragging = createMemo(() => view().state === "dragging")
  const api = createMemo(() =>
    colorWheelConnect({
      instance: instance(),
      color: color(),
      memory: memory(),
      step: step(),
      dragging: dragging(),
      disabled: own.disabled === true,
      readOnly: own.readOnly === true,
      invalid: own.invalid === true,
      focused: focused(),
      modality: modality(),
      locale: locale().locale,
      messages: messages(),
      ariaLabel: rest["aria-label"],
      ariaLabelledBy: rest["aria-labelledby"],
      ids: {
        label: rendered() ?? labelId(),
        input: partId("color-wheel", instance(), "input"),
      },
      rendered: { label: rendered() !== undefined },
      name: own.name,
      form: own.form,
      defaultColor: defaultValue() ?? DEFAULT,
    }),
  )
  const formInput = hiddenFormInput({ input: () => hiddenEl }, env)
  afterMount(() => {
    // The modality tracker must see the pointerdown that comes before the input's focus.
    onCleanup(env.modality.subscribe(() => {}))
    // A form reset restores the default colour (and ends a drag).
    onCleanup(
      formInput.track({
        onReset: () => {
          setInner(untrack(defaultValue) ?? DEFAULT)
          // The whole colour back to the default (not only its hue), with no callback.
          setMemory({})
          send({ type: "DRAG.CANCEL" })
        },
        current: () => ({ value: untrack(api).hiddenInput()["value"] as string }),
      }),
    )
  })
  const state = reactive<ColorWheelRenderState>(() => ({
    color: color(),
    hue: api().hue,
    dragging: dragging(),
    disabled: own.disabled === true,
    readOnly: own.readOnly === true,
  }))
  const ctx: Ctx = {
    api,
    send,
    state,
    registry,
    labelId,
    press: (track, e) => {
      if (!isDragPress(e) || drag.active || own.disabled === true) return
      const thickness =
        Number.parseFloat(
          getComputedStyle(track).getPropertyValue("--rind-color-wheel-thickness"),
        ) || THICKNESS
      // Only the ring takes a press: the hole and the corners do nothing.
      if (!onRing(track, e, thickness)) return
      const onThumb = thumbEl?.contains(e.target as Node) === true
      const angle = drag.press(track, e, onThumb ? untrack(api).hue : undefined)
      // Focus goes to the input (the machine moves it): the browser must not blur it.
      e.preventDefault()
      send({
        type: "POINTER.DOWN",
        angle,
        onThumb,
        modality: e.pointerType === "touch" ? "touch" : "pointer",
      })
    },
    setThumb: (el) => {
      thumbEl = el
    },
    setInput: (el) => {
      inputEl = el
    },
    setHidden: (el) => {
      hiddenEl = el
    },
    setFocused,
  }
  const merged = createMemo(() => {
    // The name is the input's (connect puts aria-label/labelledby there too).
    const { "aria-label": _l, "aria-labelledby": _lb, ...attrs } = rest as Record<string, unknown>
    return mergeProps(normalizeProps(api().root()), attrs)
  })
  const hidden = createMemo(() => normalizeProps(api().hiddenInput()))
  // The hex input that submits the colour (the range input has no name), after the parts.
  const children = () => (
    <>
      {resolveChildren(own.children, state)}
      <input {...hidden()} ref={ctx.setHidden} />
    </>
  )
  return (
    <ColorWheelContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ColorWheelContext.Provider>
  )
}

export type ColorWheelLabelProps = PartProps<JSX.LabelHTMLAttributes<HTMLLabelElement>>

/** Names the slider. */
function Label(props: ColorWheelLabelProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useColorWheel("Label")
  const id = () => rest.id ?? ctx.labelId()
  useRegisterPart(ctx.registry, "label", id)
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().label()), id: id() }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: connect sets `for` to the input
    <label {...p}>{children()}</label>
  ))
}

type DivProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

/** The hue ring: a press on the ring sets the hue and drags. */
function Track(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useColorWheel("Track")
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().track()), {
        onPointerDown: (e: PointerEvent) => ctx.press(e.currentTarget as Element, e),
      }),
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The handle on the ring, rotated by the hue; shows the input's focus. */
function Thumb(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useColorWheel("Thumb")
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().thumb()), ref: ctx.setThumb }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type ColorWheelInputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "children">

/** The visually hidden native range input of the hue: the one focusable slider. */
function Input(props: ColorWheelInputProps) {
  const ctx = useColorWheel("Input")
  const env = useEnvironment()
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().input()), {
          onKeyDown: (e: KeyboardEvent) => {
            const event = angleSliderKeyEvent(describeKey(e, env), {
              dragging: ctx.state.dragging,
            })
            if (!event || e.defaultPrevented) return
            e.preventDefault()
            // Escape ends the drag only: a surrounding layer stays open.
            if (event.type === "DRAG.CANCEL") e.stopPropagation()
            ctx.send(event)
          },
          // The native range input's own change (assistive technology, a click on it).
          onChange: (e: Event) =>
            ctx.send({
              type: "INPUT.CHANGE",
              value: Number((e.currentTarget as HTMLInputElement).value),
            }),
          onFocusIn: () => ctx.setFocused(true),
          onFocusOut: () => ctx.setFocused(false),
        }),
        ref: ctx.setInput,
      },
      props,
    ),
  )
  return <input {...merged()} />
}

export type ColorWheelValueProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

/** The formatted hue (hidden from assistive technology). */
function Value(props: ColorWheelValueProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useColorWheel("Value")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().valuePart()), rest))
  const children = () => resolveChildren(local.children, ctx.state) ?? `${ctx.api().hue}°`
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The parts, by name: `color-wheel.parts.ts` re-exports them as the `ColorWheel` namespace. */
export { Input, Label, Root, Thumb, Track, Value }
