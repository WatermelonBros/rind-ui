"use client"

// Angle Slider (add-angle-slider): a round Control whose press sets an angle around its centre
// and drags it; a visually hidden native range input is the one focusable, announced slider.
// Control, Thumb, Value and markers are presentation.

import {
  type AngleSliderEvent,
  type AngleSliderMessages,
  type AngleSliderReason,
  angleSliderConnect,
  angleSliderKeyEvent,
  angleSliderMachine,
  angleSliderMessages,
  angleValueOf,
  type ChangeDetails,
  describeKey,
  focusSafely,
  hiddenFormInput,
  isDragPress,
  type MessageOverrides,
  type Modality,
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
    "angle-slider": AngleSliderMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** What every part's `render` receives. */
export interface AngleSliderRenderState {
  /** The angle in degrees, [0, 360). */
  readonly value: number
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Api = ReturnType<typeof angleSliderConnect>

interface Ctx {
  readonly api: Api
  readonly state: AngleSliderRenderState
  readonly send: (event: AngleSliderEvent) => void
  readonly registry: PartRegistry<"label">
  readonly labelId: string
  readonly input: { current: HTMLInputElement | null }
  readonly thumb: { current: HTMLElement | null }
  readonly press: (e: PointerEvent<HTMLElement>) => void
  readonly setFocused: (focused: boolean) => void
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly latest: { current: number }
}
const AngleSliderContext = createContext<Ctx | null>(null)
function useAngleSlider(part: string): Ctx {
  const ctx = useContext(AngleSliderContext)
  if (!ctx) throw new Error(`AngleSlider.${part} must be inside AngleSlider.Root`)
  return ctx
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<AngleSliderRenderState>
}

export type AngleSliderRootProps = Omit<PartProps<"div">, "defaultValue"> & {
  /** Controlled angle in degrees, [0, 360). */
  readonly value?: number
  /** Uncontrolled angle. Default 0. */
  readonly defaultValue?: number
  /** Every change. */
  readonly onValueChange?: (value: number, details: ChangeDetails<AngleSliderEvent>) => void
  /** Once per interaction: a drag's release, a key, a native change. */
  readonly onValueCommit?: (value: number, details: { readonly reason: AngleSliderReason }) => void
  /** Degrees per step; values snap to the nearest. Default 1. */
  readonly step?: number
  /** Shift+Arrow, PageUp and PageDown. Default 15. */
  readonly largeStep?: number
  /** A step past an end wraps around. Default true. */
  readonly wrap?: boolean
  /** No change; not submitted. */
  readonly disabled?: boolean
  /** Submitted and focusable; no change. */
  readonly readOnly?: boolean
  /** Marks the input invalid. */
  readonly invalid?: boolean
  /** The form field's name. */
  readonly name?: string
  /** The form's id, when outside it. */
  readonly form?: string
  /** Overrides `valueText` (also through the provider). */
  readonly messages?: MessageOverrides<AngleSliderMessages>
  /** Default: the provider's locale (the formatted angle). */
  readonly locale?: string
}

function Root({
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  step,
  largeStep,
  wrap,
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
}: AngleSliderRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment()
  const messages = useMessages("angle-slider", angleSliderMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const registry = usePartRegistry<"label">({ scope: "angle-slider", root: instance })
  const ownLabel = useRenderedId(registry, "label")
  const input = useRef<HTMLInputElement | null>(null)
  const thumb = useRef<HTMLElement | null>(null)
  const [formInput] = useState(() => hiddenFormInput({ input: () => input.current }, env))
  const [drag] = useState(() => pointerAngleSession())
  const [machineEnv] = useState(() => ({
    drag,
    focusInput: (m: Modality) => {
      if (input.current) void focusSafely(input.current, env, "programmatic", m)
    },
  }))
  const machineProps = {
    value,
    defaultValue,
    onValueChange,
    onValueCommit,
    step,
    largeStep,
    wrap,
    disabled,
    readOnly,
  }
  const { view, send } = useMachine(angleSliderMachine, machineProps, machineEnv)
  const current = angleValueOf(machineProps, view.values.value)
  const latest = useRef(current)
  latest.current = current
  const dragging = view.state === "dragging"
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  // The modality tracker must see the pointerdown that comes before the input's focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const ids = {
    label: partId("angle-slider", instance, "label"),
    input: partId("angle-slider", instance, "input"),
  }
  const api = angleSliderConnect({
    instance,
    value: current,
    defaultValue: angleValueOf({ ...machineProps, value: undefined }, undefined),
    step: step ?? 1,
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
  })
  // After every commit: the input shows the value (a drag, a parent's change); no events.
  useIsoLayoutEffect(() => {
    formInput.sync({ value: String(latest.current) }, { dispatch: false })
  })
  const press = (e: PointerEvent<HTMLElement>) => {
    if (!isDragPress(e) || drag.active || disabled) return
    const onThumb = thumb.current?.contains(e.target as Node) === true
    const angle = drag.press(e.currentTarget, e.nativeEvent, onThumb ? current : undefined)
    // Focus goes to the input (the machine moves it): the browser must not blur it.
    e.preventDefault()
    send({
      type: "POINTER.DOWN",
      angle,
      onThumb,
      modality: e.pointerType === "touch" ? "touch" : "pointer",
    })
  }
  const state: AngleSliderRenderState = { value: current, dragging, disabled, readOnly }
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
    formInput,
    latest,
  }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  return (
    <AngleSliderContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </AngleSliderContext>
  )
}

/** Names the input. */
function Label({ render, id, ...rest }: PartProps<"label">) {
  const ctx = useAngleSlider("Label")
  const own = id ?? ctx.labelId
  useRegisterPart(ctx.registry, "label", own)
  return renderPart(
    "label",
    mergeProps({ ...normalizeProps(ctx.api.label()), id: own }, rest),
    render,
    ctx.state,
  )
}

/** The round surface: a press sets the angle around its centre and drags. */
function Control({ render, ...rest }: PartProps<"div">) {
  const ctx = useAngleSlider("Control")
  return renderPart(
    "div",
    mergeProps(joinHandlers(normalizeProps(ctx.api.control()), { onPointerDown: ctx.press }), rest),
    render,
    ctx.state,
  )
}

/** The handle, rotated by the angle; shows the input's focus. */
function Thumb({ render, ref, ...rest }: PartProps<"div">) {
  const ctx = useAngleSlider("Thumb")
  return renderPart(
    "div",
    mergeProps({ ...normalizeProps(ctx.api.thumb()), ref: composeRefs(ctx.thumb, ref) }, rest),
    render,
    ctx.state,
  )
}

/** A visually hidden native range input: the one focusable, announced slider. */
function Input({ ref, ...rest }: ComponentPropsWithRef<"input">) {
  const ctx = useAngleSlider("Input")
  const env = useEnvironment()
  const { send, formInput, latest } = ctx
  useEffect(
    () =>
      formInput.track({
        onReset: () => send({ type: "RESET" }),
        current: () => ({ value: String(latest.current) }),
        // The native range input's own change (assistive technology, a click on it).
        onNativeInput: (el) => {
          send({ type: "INPUT.CHANGE", value: Number(el.value) })
          return true
        },
      }),
    [formInput, send, latest],
  )
  // The value is written as a property by hiddenFormInput (no React value: no controlled warning).
  const { value: _value, defaultValue, ...own } = normalizeProps(ctx.api.input())
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
      defaultValue,
      ref: composeRefs(ctx.input, ref),
    },
    rest,
  )
  return <input {...props} />
}

/** The formatted angle and a degree sign (hidden from assistive technology). */
function Value({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useAngleSlider("Value")
  const props = mergeProps(normalizeProps(ctx.api.valuePart()), rest)
  return renderPart(
    "span",
    { ...props, children: children ?? `${ctx.api.formatted}°` },
    render,
    ctx.state,
  )
}

/** Holds the markers. */
function MarkerGroup({ render, ...rest }: PartProps<"div">) {
  const ctx = useAngleSlider("MarkerGroup")
  return renderPart(
    "div",
    mergeProps(normalizeProps(ctx.api.markerGroup()), rest),
    render,
    ctx.state,
  )
}

export type AngleSliderMarkerProps = Omit<PartProps<"div">, "value"> & {
  /** Where the tick sits, in degrees. */
  readonly value: number
}

/** A tick at `value` degrees, placed by `--rind-angle-slider-marker-angle`. */
function Marker({ value, render, ...rest }: AngleSliderMarkerProps) {
  const ctx = useAngleSlider("Marker")
  return renderPart(
    "div",
    mergeProps(normalizeProps(ctx.api.marker(value)), rest),
    render,
    ctx.state,
  )
}

/** The parts, by name: `angle-slider.parts.ts` re-exports them as the `AngleSlider` namespace. */
export { Control, Input, Label, Marker, MarkerGroup, Root, Thumb, Value }
