"use client"

// Color Wheel (add-color-wheel): no machine of its own. The parts run the Angle Slider machine
// on the colour's hue and map each hue back to a colour (colorWithHue), keeping the hue memory
// so a grey keeps the hue it was given. A press on the ring (not the centre) sets the hue and
// drags; a hidden input submits the colour as hex.

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
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useColorProp } from "../color-input"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  type PartRegistry,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
} from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "color-wheel": ColorWheelMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

const DEFAULT = makeColor("hsl", [0, 100, 50])
/** The ring's width when the theme sets no `--rind-color-wheel-thickness`. */
const THICKNESS = 30

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
  readonly api: Api
  readonly state: ColorWheelRenderState
  readonly send: (event: AngleSliderEvent) => void
  readonly registry: PartRegistry<"label">
  readonly labelId: string
  readonly input: { current: HTMLInputElement | null }
  readonly thumb: { current: HTMLElement | null }
  readonly press: (e: PointerEvent<HTMLElement>) => void
  readonly setFocused: (focused: boolean) => void
  readonly rangeInput: ReturnType<typeof hiddenFormInput>
  readonly latestHue: { current: number }
}
const ColorWheelContext = createContext<Ctx | null>(null)
function useColorWheel(part: string): Ctx {
  const ctx = useContext(ColorWheelContext)
  if (!ctx) throw new Error(`ColorWheel.${part} must be inside ColorWheel.Root`)
  return ctx
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<ColorWheelRenderState>
}

export type ColorWheelRootProps = Omit<PartProps<"div">, "defaultValue"> & {
  /** Controlled colour. */
  readonly value?: ColorInput
  /** Uncontrolled colour. Default `hsl(0 100% 50%)`. */
  readonly defaultValue?: ColorInput
  /** Every change of the hue, with the colour in `colorSpace`. */
  readonly onValueChange?: (value: Color, details: ChangeDetails<AngleSliderEvent>) => void
  /** Once per interaction: a drag's release, a press, a key. */
  readonly onValueCommit?: (value: Color, details: { readonly reason: AngleSliderReason }) => void
  /** The space the colour is emitted in. Default `hsl`. */
  readonly colorSpace?: "hsl" | "hsb"
  /** Degrees per step. Default 1. */
  readonly step?: number
  /** Shift+Arrow, PageUp and PageDown. Default 15. */
  readonly largeStep?: number
  /** No change; not submitted. */
  readonly disabled?: boolean
  /** Submitted and focusable; no change. */
  readonly readOnly?: boolean
  /** Marks the input invalid. */
  readonly invalid?: boolean
  /** Submits the colour as hex. */
  readonly name?: string
  /** The form's id, when outside it. */
  readonly form?: string
  /** Overrides the hue names and value text (also through the provider). */
  readonly messages?: MessageOverrides<ColorWheelMessages>
  /** Default: the provider's locale (the value text). */
  readonly locale?: string
}

function Root({
  value: valueProp,
  defaultValue: defaultProp,
  onValueChange,
  onValueCommit,
  colorSpace,
  step = 1,
  largeStep,
  disabled = false,
  readOnly = false,
  invalid = false,
  name,
  form,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: ColorWheelRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment()
  const messages = useMessages("color-wheel", colorWheelMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const registry = usePartRegistry<"label">({ scope: "color-wheel", root: instance })
  const ownLabel = useRenderedId(registry, "label")
  const value = useColorProp(valueProp, "value", "color-wheel")
  const defaultColor = useColorProp(defaultProp, "defaultValue", "color-wheel") ?? DEFAULT
  const [own, setOwn] = useState(defaultColor)
  const color = value ?? own
  // The hue a grey keeps (a grey's own hue is lost in a round trip through hex or rgb).
  const memory = useRef<ColorMemory>({})
  const hue = hueOf(color, step, memory.current)
  const latest = useRef({ color, hue })
  latest.current = { color, hue }
  const callbacks = useRef({ onValueChange, onValueCommit })
  callbacks.current = { onValueChange, onValueCommit }
  const input = useRef<HTMLInputElement | null>(null)
  const hexInput = useRef<HTMLInputElement | null>(null)
  const thumb = useRef<HTMLElement | null>(null)
  const [rangeInput] = useState(() => hiddenFormInput({ input: () => input.current }, env))
  const [hexForm] = useState(() => hiddenFormInput({ input: () => hexInput.current }, env))
  const [drag] = useState(() => pointerAngleSession())
  const [machineEnv] = useState(() => ({
    drag,
    focusInput: (m: Modality) => {
      if (input.current) void focusSafely(input.current, env, "programmatic", m)
    },
  }))
  const toColor = (h: number) => {
    memory.current = { ...memory.current, hue: h }
    return colorWithHue(latest.current.color, h, colorSpace, memory.current)
  }
  // The hue is always controlled: the colour is the source, held here when uncontrolled.
  const machineProps = {
    value: hue,
    step,
    largeStep,
    wrap: true,
    disabled,
    readOnly,
    onValueChange: (h: number, d: ChangeDetails<AngleSliderEvent>) => {
      const next = toColor(h)
      latest.current = { color: next, hue: h }
      if (value === undefined) setOwn(next)
      callbacks.current.onValueChange?.(next, d)
    },
    onValueCommit: (_h: number, d: { readonly reason: AngleSliderReason }) =>
      callbacks.current.onValueCommit?.(latest.current.color, d),
  }
  const { view, send } = useMachine(angleSliderMachine, machineProps, machineEnv)
  const dragging = view.state === "dragging"
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  // The modality tracker must see the pointerdown that comes before the input's focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const ids = {
    label: partId("color-wheel", instance, "label"),
    input: partId("color-wheel", instance, "input"),
  }
  const api = colorWheelConnect({
    instance,
    color,
    memory: memory.current,
    step,
    dragging,
    disabled,
    readOnly,
    invalid,
    focused,
    modality,
    locale,
    messages,
    ariaLabel,
    ariaLabelledBy,
    ids: { ...ids, label: ownLabel ?? ids.label },
    rendered: { label: ownLabel !== undefined },
    name,
    form,
    defaultColor,
  })
  const hex = String(api.hiddenInput()["value"])
  const latestHex = useRef(hex)
  latestHex.current = hex
  // After every commit: both inputs show the value (a drag, a parent's change); no events.
  useIsoLayoutEffect(() => {
    rangeInput.sync({ value: String(latest.current.hue) }, { dispatch: false })
    hexForm.sync({ value: latestHex.current }, { dispatch: false })
  })
  const defaults = useRef(defaultColor)
  defaults.current = defaultColor
  useEffect(
    () =>
      hexForm.track({
        // The whole colour back to the default (not only its hue), with no callback.
        onReset: () => {
          memory.current = {}
          send({ type: "DRAG.CANCEL" })
          setOwn(defaults.current)
        },
        current: () => ({ value: latestHex.current }),
      }),
    [hexForm, send],
  )
  const press = (e: PointerEvent<HTMLElement>) => {
    if (!isDragPress(e) || drag.active || disabled) return
    const track = e.currentTarget
    const thickness =
      Number.parseFloat(getComputedStyle(track).getPropertyValue("--rind-color-wheel-thickness")) ||
      THICKNESS
    if (!onRing(track, e.nativeEvent, thickness)) return
    const onThumb = thumb.current?.contains(e.target as Node) === true
    const angle = drag.press(track, e.nativeEvent, onThumb ? hue : undefined)
    // Focus goes to the input (the machine moves it): the browser must not blur it.
    e.preventDefault()
    send({
      type: "POINTER.DOWN",
      angle,
      onThumb,
      modality: e.pointerType === "touch" ? "touch" : "pointer",
    })
  }
  const state: ColorWheelRenderState = { color, hue, dragging, disabled, readOnly }
  const latestHue = useRef(hue)
  latestHue.current = hue
  const ctx: Ctx = {
    api,
    state,
    send,
    registry,
    labelId: ids.label,
    input,
    thumb,
    press,
    setFocused,
    rangeInput,
    latestHue,
  }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  // The hex is written as a property by hiddenFormInput (no React value: none to reconcile).
  const { value: _hex, ...hidden } = normalizeProps(api.hiddenInput())
  return (
    <ColorWheelContext value={ctx}>
      {renderPart(
        "div",
        {
          ...props,
          children: (
            <>
              {children}
              <input {...hidden} ref={hexInput} />
            </>
          ),
        },
        render,
        state,
      )}
    </ColorWheelContext>
  )
}

/** Names the slider. */
function Label({ render, id, ...rest }: PartProps<"label">) {
  const ctx = useColorWheel("Label")
  const own = id ?? ctx.labelId
  useRegisterPart(ctx.registry, "label", own)
  return renderPart(
    "label",
    mergeProps({ ...normalizeProps(ctx.api.label()), id: own }, rest),
    render,
    ctx.state,
  )
}

/** The hue ring: a press on the ring sets the hue and drags. */
function Track({ render, ...rest }: PartProps<"div">) {
  const ctx = useColorWheel("Track")
  return renderPart(
    "div",
    mergeProps(joinHandlers(normalizeProps(ctx.api.track()), { onPointerDown: ctx.press }), rest),
    render,
    ctx.state,
  )
}

/** The handle on the ring, rotated by the hue; shows the input's focus. */
function Thumb({ render, ref, ...rest }: PartProps<"div">) {
  const ctx = useColorWheel("Thumb")
  return renderPart(
    "div",
    mergeProps({ ...normalizeProps(ctx.api.thumb()), ref: composeRefs(ctx.thumb, ref) }, rest),
    render,
    ctx.state,
  )
}

/** A visually hidden native range input of the hue: the one focusable slider. */
function Input({ ref, ...rest }: ComponentPropsWithRef<"input">) {
  const ctx = useColorWheel("Input")
  const env = useEnvironment()
  const { send, rangeInput, latestHue } = ctx
  useEffect(
    () =>
      rangeInput.track({
        // The hex input owns the form reset.
        onReset: () => {},
        resetsWithForm: false,
        current: () => ({ value: String(latestHue.current) }),
        // The native range input's own change (assistive technology, a click on it).
        onNativeInput: (el) => {
          send({ type: "INPUT.CHANGE", value: Number(el.value) })
          return true
        },
      }),
    [rangeInput, send, latestHue],
  )
  // The value is written as a property by hiddenFormInput; `defaultValue` is the attribute.
  const { value: _value, ...own } = normalizeProps(ctx.api.input())
  const props = mergeProps(
    {
      ...joinHandlers(own, {
        onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
          const event = angleSliderKeyEvent(describeKey(e.nativeEvent, env), {
            dragging: ctx.state.dragging,
          })
          if (!event || e.defaultPrevented) return
          e.preventDefault()
          // Escape ends the drag only: a surrounding layer stays open.
          if (event.type === "DRAG.CANCEL") e.stopPropagation()
          send(event)
        },
        onFocus: () => ctx.setFocused(true),
        onBlur: () => ctx.setFocused(false),
      }),
      ref: composeRefs(ctx.input, ref),
    },
    rest,
  )
  return <input {...props} />
}

/** The formatted hue and a degree sign (hidden from assistive technology). */
function Value({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useColorWheel("Value")
  const props = mergeProps(normalizeProps(ctx.api.valuePart()), rest)
  return renderPart(
    "span",
    { ...props, children: children ?? `${ctx.api.hue}°` },
    render,
    ctx.state,
  )
}

/** The parts, by name: `color-wheel.parts.ts` re-exports them as the `ColorWheel` namespace. */
export { Input, Label, Root, Thumb, Track, Value }
