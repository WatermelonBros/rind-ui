/** @jsxImportSource solid-js */
// Angle Slider (add-angle-slider): a dial whose value is an angle. A visually hidden native range
// input is the only focusable and announced element; a press on the Control sets the angle
// from the pointer (a press on the Thumb keeps its offset) and drags on.
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
    "angle-slider": AngleSliderMessages
  }
}

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
  readonly api: Accessor<Api>
  readonly send: (event: AngleSliderEvent) => void
  readonly state: AngleSliderRenderState
  readonly registry: PartRegistry<"label">
  readonly labelId: Accessor<string>
  readonly press: (control: Element, e: PointerEvent) => void
  readonly setThumb: (el: Element | null) => void
  readonly setInput: (el: HTMLInputElement | null) => void
  readonly setFocused: (focused: boolean) => void
}
const AngleSliderContext = createContext<Ctx>()
function useAngleSlider(part: string): Ctx {
  const ctx = useContext(AngleSliderContext)
  if (!ctx) throw new Error(`AngleSlider.${part} must be inside AngleSlider.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<AngleSliderRenderState> | undefined
  readonly children?: JSX.Element | ((state: AngleSliderRenderState) => JSX.Element)
}

export type AngleSliderRootProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Controlled angle in degrees, [0, 360). */
  readonly value?: number | undefined
  /** Uncontrolled angle. Default 0. */
  readonly defaultValue?: number | undefined
  /** Every change (`details.reason` is the event; `details.cancel()` refuses it). */
  readonly onValueChange?:
    | ((value: number, details: ChangeDetails<AngleSliderEvent>) => void)
    | undefined
  /** Once per interaction: a drag's release, a key, a native change. */
  readonly onValueCommit?:
    | ((value: number, details: { readonly reason: AngleSliderReason }) => void)
    | undefined
  /** Degrees per step. Default 1. */
  readonly step?: number | undefined
  /** Shift+Arrow, PageUp and PageDown. Default 15. */
  readonly largeStep?: number | undefined
  /** A step past an end wraps around. Default true. */
  readonly wrap?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly invalid?: boolean | undefined
  /** The form field's name. */
  readonly name?: string | undefined
  /** The form's id, when outside it. */
  readonly form?: string | undefined
  readonly messages?: MessageOverrides<AngleSliderMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}

function Root(props: AngleSliderRootProps) {
  const [own, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "onValueCommit",
    "step",
    "largeStep",
    "wrap",
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
  const messages = useMessages("angle-slider", angleSliderMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const registry = usePartRegistry<"label">({ scope: "angle-slider", root: instance() })
  const rendered = useRenderedId(registry, "label")
  const labelId = createMemo(() => partId("angle-slider", instance(), "label"))
  const ids = createMemo(() => ({
    label: rendered() ?? labelId(),
    input: partId("angle-slider", instance(), "input"),
  }))
  let inputEl: HTMLInputElement | null = null
  let thumbEl: Element | null = null
  const formInput = hiddenFormInput({ input: () => inputEl }, env)
  const drag = pointerAngleSession()
  const machineProps = createMemo(() => ({
    ...(own.value === undefined ? {} : { value: own.value }),
    defaultValue: own.defaultValue,
    onValueChange: (v: number, d: ChangeDetails<AngleSliderEvent>) => own.onValueChange?.(v, d),
    onValueCommit: (v: number, d: { readonly reason: AngleSliderReason }) =>
      own.onValueCommit?.(v, d),
    step: own.step,
    largeStep: own.largeStep,
    wrap: own.wrap,
    disabled: own.disabled === true,
    readOnly: own.readOnly === true,
  }))
  const { view, send } = useMachine(angleSliderMachine, machineProps, {
    drag,
    focusInput: (m: Modality) => {
      if (inputEl) void focusSafely(inputEl, env, "programmatic", m)
    },
  })
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const value = () => angleValueOf(machineProps(), view().values.value)
  const dragging = () => view().state === "dragging"
  const api = createMemo(() =>
    angleSliderConnect({
      instance: instance(),
      value: value(),
      defaultValue: angleValueOf({ ...machineProps(), value: undefined }, undefined),
      step: own.step !== undefined && own.step > 0 ? own.step : 1,
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
      ids: ids(),
      rendered: { label: rendered() !== undefined },
      name: own.name,
      form: own.form,
    }),
  )
  afterMount(() => {
    // The modality tracker must see the pointerdown that comes before the input's focus.
    onCleanup(env.modality.subscribe(() => {}))
    // A form reset restores the default; the browser's own reset is re-synced after it.
    onCleanup(
      formInput.track({
        onReset: () => send({ type: "RESET" }),
        current: () => ({ value: String(untrack(value)) }),
        // The native range input's own change (assistive technology, a click on it).
        onNativeInput: (el) => {
          send({ type: "INPUT.CHANGE", value: Number(el.value) })
          return true
        },
      }),
    )
  })
  const state = reactive<AngleSliderRenderState>(() => ({
    value: value(),
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
    press: (control, e) => {
      if (!isDragPress(e) || drag.active || own.disabled === true) return
      const onThumb = thumbEl?.contains(e.target as Node) === true
      const angle = drag.press(control, e, onThumb ? untrack(value) : undefined)
      // The press would focus the Control's descendants: the input takes the focus instead.
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
    setFocused,
  }
  const merged = createMemo(() => {
    // The name is the input's (connect puts aria-label/labelledby there).
    const { "aria-label": _l, "aria-labelledby": _lb, ...attrs } = rest as Record<string, unknown>
    return mergeProps(normalizeProps(api().root()), attrs)
  })
  const children = () => resolveChildren(own.children, state)
  return (
    <AngleSliderContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </AngleSliderContext.Provider>
  )
}

export type AngleSliderLabelProps = PartProps<JSX.LabelHTMLAttributes<HTMLLabelElement>>

/** Names the input. */
function Label(props: AngleSliderLabelProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAngleSlider("Label")
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

/** The dial: a press sets the angle from the pointer and drags on. */
function Control(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAngleSlider("Control")
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().control()), {
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

/** The handle, rotated by the angle; shows the input's focus. */
function Thumb(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAngleSlider("Thumb")
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().thumb()), ref: ctx.setThumb }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type AngleSliderInputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "children">

/** The visually hidden native range input: the focus, the keys, the form value. */
function Input(props: AngleSliderInputProps) {
  const ctx = useAngleSlider("Input")
  const env = useEnvironment()
  const merged = createMemo(() => {
    const api = normalizeProps(ctx.api().input())
    // The `value` attribute is the default a form reset restores; the property is the value.
    const initial = api["defaultValue"]
    delete api["defaultValue"]
    if (initial !== undefined) api["attr:value"] = initial
    return mergeProps(
      {
        ...joinHandlers(api, {
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
          onFocusIn: () => ctx.setFocused(true),
          onFocusOut: () => ctx.setFocused(false),
        }),
        ref: ctx.setInput,
      },
      props,
    )
  })
  return <input {...merged()} />
}

export type AngleSliderValueProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

/** The formatted angle and a degree sign (hidden from assistive technology). */
function Value(props: AngleSliderValueProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAngleSlider("Value")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().valuePart()), rest))
  const children = () => resolveChildren(local.children, ctx.state) ?? `${ctx.api().formatted}°`
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** Holds the Markers (`aria-hidden`). */
function MarkerGroup(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAngleSlider("MarkerGroup")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().markerGroup()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type AngleSliderMarkerProps = DivProps & {
  /** The angle it marks (`--rind-angle-slider-marker-angle`). */
  readonly value: number
}

/** A tick at `value`: under, at or over the current angle (`data-state`). */
function Marker(props: AngleSliderMarkerProps) {
  const [local, rest] = splitProps(props, ["value", "render", "children"])
  const ctx = useAngleSlider("Marker")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().marker(local.value)), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The parts, by name: `angle-slider.parts.ts` re-exports them as the `AngleSlider` namespace. */
export { Control, Input, Label, Marker, MarkerGroup, Root, Thumb, Value }
