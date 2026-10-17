// Color Area parts: wiring only. The machine owns the colour, connect every attribute; here
// the two axis inputs are reached for property sync, reset and native adoption, and the
// Root's press is measured once by pointer-drag (2D).

import {
  areaAxes,
  areaValueOf,
  areaWorking,
  blurEvent,
  type Color,
  type ColorAreaEvent,
  type ColorAreaMessages,
  type ColorAreaReason,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorCommitDetails,
  type ColorInput,
  type ColorNameProp,
  type ColorSpace,
  colorAreaConnect,
  colorAreaKeyEvent,
  colorAreaMachine,
  colorAreaMessages,
  describeKey,
  focusEvent,
  focusSafely,
  hiddenFormInput,
  isDragPress,
  type MessageOverrides,
  type Modality,
  makeColor,
  partId,
  pointerDragSession2D,
  textSelection,
  thumbPoint,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
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
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "color-area": ColorAreaMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

type Axis = "x" | "y"
type FormInput = ReturnType<typeof hiddenFormInput>

export interface ColorAreaState {
  readonly color: Color
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

interface Ctx {
  readonly api: ReturnType<typeof colorAreaConnect>
  readonly state: ColorAreaState
  readonly send: (e: ColorAreaEvent) => void
  readonly inputs: { current: Record<Axis, HTMLInputElement | null> }
  readonly formInput: (axis: Axis) => FormInput
  readonly latest: { current: { x: number; y: number } }
  readonly thumb: { current: HTMLElement | null }
  readonly dir: "ltr" | "rtl"
}

const AreaContext = createContext<Ctx | null>(null)
function useArea(part: string): Ctx {
  const ctx = useContext(AreaContext)
  if (!ctx) throw new Error(`ColorArea.${part} must be inside ColorArea.Root`)
  return ctx
}

export type ColorAreaRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir" | "color"
> & {
  readonly children?: ReactNode
  readonly value?: ColorInput
  /** Default `hsb(0, 0%, 100%)`; a later change only changes what a form reset restores. */
  readonly defaultValue?: ColorInput
  readonly onValueChange?: (color: Color, details: ColorChangeDetails<ColorAreaReason>) => void
  /** Once at the end of each interaction that changed the colour. */
  readonly onValueCommit?: (color: Color, details: ColorCommitDetails<ColorAreaReason>) => void
  /** The space of the axes (default: the first colour's space, else `hsb`). */
  readonly colorSpace?: ColorSpace
  readonly xChannel?: ColorChannel
  readonly yChannel?: ColorChannel
  readonly xName?: string
  readonly yName?: string
  readonly form?: string
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly colorName?: ColorNameProp
  readonly locale?: string
  readonly dir?: "ltr" | "rtl"
  readonly messages?: MessageOverrides<ColorAreaMessages>
  readonly render?: RenderProp<ColorAreaState>
}

const DEFAULT = makeColor("hsb", [0, 0, 100])

/** A two-dimensional picker for two channels of a colour (two native range inputs). */
function Root({
  value: valueProp,
  defaultValue: defaultProp,
  onValueChange,
  onValueCommit,
  colorSpace,
  xChannel,
  yChannel,
  xName,
  yName,
  form,
  disabled = false,
  readOnly = false,
  colorName,
  locale: ownLocale,
  dir: ownDir,
  messages: ownMessages,
  render,
  id,
  ref,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: ColorAreaRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const { locale, dir } = useLocale(ownLocale, ownDir)
  const messages = useMessages("color-area", colorAreaMessages, ownMessages)
  const value = useColorProp(valueProp, "value", "color-area")
  const defaultValue = useColorProp(defaultProp, "defaultValue", "color-area")
  // The space of the axes: the prop, else the first colour's (read once), else hsb.
  const [firstSpace] = useState<ColorSpace>(() => (value ?? defaultValue)?.space ?? "hsb")
  const axes = areaAxes(colorSpace ?? firstSpace, xChannel, yChannel)
  const inputs = useRef<Record<Axis, HTMLInputElement | null>>({ x: null, y: null })
  const thumb = useRef<HTMLElement | null>(null)
  const latest = useRef({ x: 0, y: 0 })
  const [formInputs] = useState(() => new Map<Axis, FormInput>())
  const formInput = (axis: Axis) => {
    let cap = formInputs.get(axis)
    if (!cap) {
      cap = hiddenFormInput({ input: () => inputs.current[axis] }, env)
      formInputs.set(axis, cap)
    }
    return cap
  }
  const focusAxis = (axis: Axis, modality: Modality) => {
    const el = inputs.current[axis]
    if (el) void focusSafely(el, env, "programmatic", modality)
  }
  const focusRef = useRef(focusAxis)
  focusRef.current = focusAxis
  const [drag] = useState(() => pointerDragSession2D())
  const [machineEnv] = useState(() => ({
    inputs: {
      sync: (x: number, y: number, dispatch: readonly [boolean, boolean]) => {
        formInput("x").sync({ value: String(x) }, { dispatch: dispatch[0] })
        formInput("y").sync({ value: String(y) }, { dispatch: dispatch[1] })
      },
    },
    drag,
    focusAxis: (axis: Axis, modality: Modality) => focusRef.current(axis, modality),
  }))
  const callbacks = useRef({ onValueChange, onValueCommit })
  callbacks.current = { onValueChange, onValueCommit }
  const machineProps = {
    value,
    defaultValue,
    axes,
    fallback: DEFAULT,
    disabled,
    readOnly,
    onValueChange: (c: Color, d: { reason: string; cancel(): void }) => {
      // A form reset reports nothing (spec "Form Participation").
      if (d.reason === "RESET") return
      callbacks.current.onValueChange?.(c, {
        reason: d.reason as ColorAreaReason,
        space: axes.space,
        cancel: d.cancel,
      })
    },
    onValueCommit: (c: Color, d: ColorCommitDetails<ColorAreaReason>) =>
      callbacks.current.onValueCommit?.(c, d),
  }
  const { view, send } = useMachine(colorAreaMachine, machineProps, machineEnv)
  const color = areaWorking(machineProps, view.context, view.values.value)
  const focused = view.context.focused
  const modality = useModality(env.modality, focused !== null)
  const dragging = view.matches("dragging")
  latest.current = {
    x: Number(thumbPoint(color, axes, view.context.memory).x),
    y: Number(thumbPoint(color, axes, view.context.memory).y),
  }
  const api = colorAreaConnect({
    instance,
    color,
    memory: view.context.memory,
    axes,
    dir,
    disabled,
    readOnly,
    dragging,
    focused,
    tabStop: view.context.tabStop,
    changed: view.context.changed,
    modality,
    messages,
    locale,
    colorName,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    ids: { root: instance, input: (axis) => partId("color-area", instance, `input-${axis}`) },
    names: { x: xName, y: yName },
    form,
    defaultColor: areaValueOf({ ...machineProps, value: undefined }, undefined),
  })
  // After every commit: each input shows the value (hydration, a parent's change); no events.
  const values = {
    x: Number(api.input("x")["aria-valuenow"]),
    y: Number(api.input("y")["aria-valuenow"]),
  }
  const shown = useRef(values)
  shown.current = values
  useIsoLayoutEffect(() => {
    formInput("x").sync({ value: String(shown.current.x) }, { dispatch: false })
    formInput("y").sync({ value: String(shown.current.y) }, { dispatch: false })
  })
  // The modality tracker must see the pointerdown that comes before the input's focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const selection = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (dragging) return
    selection.current?.()
    selection.current = null
  }, [dragging])

  const state: ColorAreaState = { color, dragging, disabled, readOnly }
  const ctx: Ctx = {
    api,
    state,
    send,
    inputs,
    formInput,
    latest: shown,
    thumb,
    dir,
  }
  const press = (e: PointerEvent<HTMLElement>) => {
    if (!isDragPress(e) || drag.active || disabled) return
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
    const onThumb = thumb.current?.contains(e.target as Node) === true
    const anchor = onThumb ? latest.current : undefined
    const point = drag.press(e.currentTarget, e.nativeEvent, { dir, anchor })
    // Focus goes to the x input (the machine moves it): the browser must not blur it.
    e.preventDefault()
    const touch = e.pointerType === "touch"
    if (touch && !readOnly) selection.current = textSelection(e.currentTarget, env, true)
    send({ type: "POINTER.DOWN", point, onThumb, modality: touch ? "touch" : "pointer" })
  }
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(api.root()), { onPointerDown: press }),
      ref,
    },
    rest,
  )
  return (
    <AreaContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </AreaContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<ColorAreaState>
}

/** The gradient: decorative. */
function Background({ render, ...rest }: PartProps<"div">) {
  const ctx = useArea("Background")
  return renderPart(
    "div",
    mergeProps(normalizeProps(ctx.api.background()), rest),
    render,
    ctx.state,
  )
}

/** One axis input (x or y): the focusable `slider`s, inside the Thumb. */
function AxisInput({ axis }: { readonly axis: Axis }) {
  const ctx = useArea("Thumb")
  const env = useEnvironment()
  const { send, formInput, latest } = ctx
  useEffect(
    () =>
      formInput(axis).track({
        onReset: () => send({ type: "RESET" }),
        resetsWithForm: axis === "x",
        current: () => ({ value: String(latest.current[axis]) }),
        onNativeInput: (input) => {
          send({ type: "INPUT.CHANGE", axis, value: Number(input.value) })
          return true
        },
      }),
    [formInput, axis, send, latest],
  )
  const props = joinHandlers(normalizeProps(ctx.api.input(axis)), {
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      const event = colorAreaKeyEvent(describeKey(e.nativeEvent, env), {
        dir: ctx.dir,
        dragging: ctx.state.dragging,
      })
      if (!event || e.defaultPrevented) return
      e.preventDefault()
      // Escape ends the drag only: a surrounding layer stays open.
      if (event.type === "DRAG.CANCEL") e.stopPropagation()
      send(event)
    },
    onFocus: (e: { currentTarget: Element }) =>
      send({ ...focusEvent(e.currentTarget, env.modality), axis }),
    onBlur: () => send({ ...blurEvent(env.modality), axis }),
  })
  return (
    <input
      {...props}
      ref={(el) => {
        ctx.inputs.current[axis] = el
      }}
    />
  )
}

/** The handle: positioned from the value; renders the x and y inputs. */
function Thumb({ render, ref, children, ...rest }: PartProps<"div">) {
  const ctx = useArea("Thumb")
  const props = mergeProps(
    { ...normalizeProps(ctx.api.thumb()), ref: composeRefs(ctx.thumb, ref) },
    rest,
  )
  return renderPart(
    "div",
    {
      ...props,
      children: (
        <>
          {children}
          <AxisInput axis="x" />
          <AxisInput axis="y" />
        </>
      ),
    },
    render,
    ctx.state,
  )
}

export const ColorArea = { Root, Background, Thumb }
