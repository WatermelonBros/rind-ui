/** @jsxImportSource solid-js */
// Color Area parts: wiring only. The machine owns the colour, connect every attribute; here
// the two axis inputs are reached for property sync, reset and native adoption, and the
// Root's press is measured once by pointer-drag (2D).
import {
  blurEvent,
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorCommitDetails,
  type ColorInput,
  type ColorNameProp,
  type ColorSpace,
  describeKey,
  focusEvent,
  focusSafely,
  hiddenFormInput,
  isDragPress,
  type MessageOverrides,
  type Modality,
  makeColor,
  mergeFieldProps,
  partId,
  pointerDragSession2D,
  textSelection,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  areaAxes,
  areaValueOf,
  areaWorking,
  type ColorAreaEvent,
  type ColorAreaMessages,
  type ColorAreaReason,
  colorAreaConnect,
  colorAreaKeyEvent,
  colorAreaMachine,
  colorAreaMessages,
  thumbPoint,
} from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useColorProp } from "../color-input"
import { useFieldBindingPeek } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "color-area": ColorAreaMessages
  }
}

type Axis = "x" | "y"
type FormInput = ReturnType<typeof hiddenFormInput>

export interface ColorAreaState {
  readonly color: Color
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

interface Ctx {
  readonly api: Accessor<ReturnType<typeof colorAreaConnect>>
  readonly state: ColorAreaState
  readonly send: (e: ColorAreaEvent) => void
  readonly inputs: Record<Axis, HTMLInputElement | null>
  readonly formInput: (axis: Axis) => FormInput
  readonly shown: Accessor<{ x: number; y: number }>
  readonly setThumb: (el: Element | null) => void
  readonly dir: Accessor<"ltr" | "rtl">
}

const AreaContext = createContext<Ctx>()
function useArea(part: string): Ctx {
  const ctx = useContext(AreaContext)
  if (!ctx) throw new Error(`ColorArea.${part} must be inside ColorArea.Root`)
  return ctx
}

export type ColorAreaRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onChange" | "dir" | "color" | "id"
> & {
  readonly id?: string | undefined
  /** The area's parts (Background, Thumb). */
  readonly children?: JSX.Element | ((state: ColorAreaState) => JSX.Element)
  readonly value?: ColorInput | null | undefined
  /** Default `hsb(0, 0%, 100%)`; a later change only changes what a form reset restores. */
  readonly defaultValue?: ColorInput | null | undefined
  /**
   * Each applied change, in the space of the colour you passed; not for a change that leaves
   * the emitted colour as it is (hue at black).
   */
  readonly onValueChange?:
    | ((color: Color, details: ColorChangeDetails<ColorAreaReason>) => void)
    | undefined
  /** Once at the end of each interaction that changed the colour. */
  readonly onValueCommit?:
    | ((color: Color, details: ColorCommitDetails<ColorAreaReason>) => void)
    | undefined
  /** The space of the axes (default: the first colour's space, else `hsb`). */
  readonly colorSpace?: ColorSpace | undefined
  /** The horizontal channel. Default: saturation (hsb, hsl), red (rgb). */
  readonly xChannel?: ColorChannel | undefined
  /** The vertical channel. Default: brightness (hsb), lightness (hsl), green (rgb). */
  readonly yChannel?: ColorChannel | undefined
  /** Submits the x channel under this name. */
  readonly xName?: string | undefined
  /** Submits the y channel under this name. */
  readonly yName?: string | undefined
  /** The id of the form the inputs belong to. */
  readonly form?: string | undefined
  /** Ignores presses and keys. */
  readonly disabled?: boolean | undefined
  /** Focusable, changes nothing. */
  readonly readOnly?: boolean | undefined
  /** Replaces the colour name in the value text. */
  readonly colorName?: ColorNameProp | undefined
  /** Formats the value text. Default: the provider's locale. */
  readonly locale?: string | undefined
  /** Mirrors the x axis. Default: the provider's direction. */
  readonly dir?: "ltr" | "rtl" | undefined
  /** Names, role description, value text and colour words. */
  readonly messages?: MessageOverrides<ColorAreaMessages> | undefined
  /** Another element: a function receiving the props to spread and the area's state. */
  readonly render?: RenderProp<ColorAreaState> | undefined
}

const DEFAULT = makeColor("hsb", [0, 0, 100])

/** A two-dimensional picker for two channels of a colour (two native range inputs). */
function Root(props: ColorAreaRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "onValueCommit",
    "colorSpace",
    "xChannel",
    "yChannel",
    "xName",
    "yName",
    "form",
    "disabled",
    "readOnly",
    "colorName",
    "locale",
    "dir",
    "messages",
    "render",
    "id",
    "children",
    "aria-label",
    "aria-labelledby",
    "aria-describedby",
  ])
  const env = useEnvironment()
  const instance = useRootId(() => local.id)
  const loc = useLocale(
    () => local.locale,
    () => local.dir,
  )
  const messages = useMessages("color-area", colorAreaMessages, () => local.messages)
  const value = useColorProp(() => local.value, "value", "color-area")
  const defaultValue = useColorProp(() => local.defaultValue, "defaultValue", "color-area")
  // OR-merged with an enclosing Field, rind's Fieldset and a native <fieldset disabled>.
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const fieldFlags = createMemo(() =>
    mergeFieldProps(
      { role: "group", labelable: false, disabled: local.disabled, readOnly: local.readOnly },
      enclosing?.() ?? null,
    ),
  )
  const disabled = () => fieldFlags().disabled || fieldsetDisabled() || fieldsetDom()
  const readOnly = () => fieldFlags().readOnly
  // The space of the axes: the prop, else the first colour's (read once), else hsb.
  const firstSpace: ColorSpace = untrack(() => (value() ?? defaultValue())?.space ?? "hsb")
  const axes = createMemo(() =>
    areaAxes(local.colorSpace ?? firstSpace, local.xChannel, local.yChannel),
  )
  const inputs: Record<Axis, HTMLInputElement | null> = { x: null, y: null }
  const [thumb, setThumb] = createSignal<Element | null>(null)
  const formInputs = new Map<Axis, FormInput>()
  const formInput = (axis: Axis) => {
    let cap = formInputs.get(axis)
    if (!cap) {
      cap = hiddenFormInput({ input: () => inputs[axis] }, env)
      formInputs.set(axis, cap)
    }
    return cap
  }
  const drag = pointerDragSession2D()
  const machineEnv = {
    inputs: {
      sync: (x: number, y: number, dispatch: readonly [boolean, boolean]) => {
        formInput("x").sync({ value: String(x) }, { dispatch: dispatch[0] })
        formInput("y").sync({ value: String(y) }, { dispatch: dispatch[1] })
      },
    },
    drag,
    focusAxis: (axis: Axis, modality: Modality) => {
      const el = inputs[axis]
      if (el) void focusSafely(el, env, "programmatic", modality)
    },
  }
  const machineProps = createMemo(() => ({
    value: value(),
    defaultValue: defaultValue(),
    axes: axes(),
    fallback: DEFAULT,
    disabled: disabled(),
    readOnly: readOnly(),
    onValueChange: (c: Color, d: { reason: string; cancel(): void }) => {
      // A form reset reports nothing (spec "Form Participation").
      if (d.reason === "RESET") return
      local.onValueChange?.(c, {
        reason: d.reason as ColorAreaReason,
        space: untrack(axes).space,
        cancel: d.cancel,
      } as ColorChangeDetails<ColorAreaReason>)
    },
    onValueCommit: (c: Color, d: ColorCommitDetails<ColorAreaReason>) =>
      local.onValueCommit?.(c, d),
  }))
  const { view, send } = useMachine(colorAreaMachine, machineProps, machineEnv)
  const color = createMemo(() => areaWorking(machineProps(), view().context, view().values.value))
  const focused = createMemo(() => view().context.focused !== null)
  const modality = useModality(env.modality, focused)
  const dragging = createMemo(() => view().matches("dragging"))
  const api = createMemo(() =>
    colorAreaConnect({
      instance: instance(),
      color: color(),
      memory: view().context.memory,
      axes: axes(),
      dir: loc().dir,
      disabled: disabled(),
      readOnly: readOnly(),
      dragging: dragging(),
      focused: view().context.focused,
      tabStop: view().context.tabStop,
      changed: view().context.changed,
      modality: modality(),
      messages: messages(),
      locale: loc().locale,
      colorName: local.colorName,
      ariaLabel: local["aria-label"],
      ariaLabelledBy: local["aria-labelledby"],
      ariaDescribedBy: local["aria-describedby"],
      ids: {
        root: instance(),
        input: (axis) => partId("color-area", instance(), `input-${axis}`),
      },
      names: { x: local.xName, y: local.yName },
      form: local.form,
      defaultColor: areaValueOf({ ...machineProps(), value: undefined }, undefined),
    }),
  )
  // The values each input shows (hydration, a parent's change); no events.
  const shown = createMemo(
    () => ({
      x: Number(api().input("x")["aria-valuenow"]),
      y: Number(api().input("y")["aria-valuenow"]),
    }),
    undefined,
    { equals: (a, b) => a.x === b.x && a.y === b.y },
  )
  afterMount(() => {
    const node = inputs.x
    if (!node) return
    const fieldset = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(fieldset.disabled)
    onCleanup(fieldset.stop)
  })
  afterMount(() => {
    createEffect(() => {
      const s = shown()
      formInput("x").sync({ value: String(s.x) }, { dispatch: false })
      formInput("y").sync({ value: String(s.y) }, { dispatch: false })
    })
    // The modality tracker must see the pointerdown that comes before the input's focus.
    onCleanup(env.modality.subscribe(() => {}))
  })
  let selection: (() => void) | null = null
  createEffect(
    on(dragging, (d) => {
      if (d) return
      selection?.()
      selection = null
    }),
  )
  const state = reactive<ColorAreaState>(() => ({
    color: color(),
    dragging: dragging(),
    disabled: disabled(),
    readOnly: readOnly(),
  }))
  const ctx: Ctx = {
    api,
    state,
    send,
    inputs,
    formInput,
    shown,
    setThumb,
    dir: () => loc().dir,
  }
  const press = (e: PointerEvent) => {
    if (!isDragPress(e) || drag.active || disabled()) return
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
    const surface = e.currentTarget as HTMLElement
    const onThumb = untrack(thumb)?.contains(e.target as Node) === true
    const p = thumbPoint(untrack(color), untrack(axes), untrack(view).context.memory)
    const anchor = onThumb ? { x: Number(p.x), y: Number(p.y) } : undefined
    const point = drag.press(surface, e, { dir: untrack(loc).dir, anchor })
    // Focus goes to the x input (the machine moves it): the browser must not blur it.
    e.preventDefault()
    const touch = e.pointerType === "touch"
    if (touch && !readOnly()) selection = textSelection(surface, env, true)
    send({ type: "POINTER.DOWN", point, onThumb, modality: touch ? "touch" : "pointer" })
  }
  const merged = createMemo(() =>
    mergeProps(joinHandlers(normalizeProps(api().root()), { onPointerDown: press }), rest),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <AreaContext.Provider value={ctx}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </AreaContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the area's state. */
  readonly render?: RenderProp<ColorAreaState> | undefined
  readonly children?: JSX.Element | ((state: ColorAreaState) => JSX.Element)
}

/** The gradient: decorative. */
function Background(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useArea("Background")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().background()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** One axis input (x or y): the focusable `slider`s, inside the Thumb. */
function AxisInput(props: { readonly axis: Axis }) {
  const ctx = useArea("Thumb")
  const env = useEnvironment()
  afterMount(() =>
    onCleanup(
      ctx.formInput(props.axis).track({
        onReset: () => ctx.send({ type: "RESET" }),
        resetsWithForm: props.axis === "x",
        current: () => ({ value: String(untrack(ctx.shown)[props.axis]) }),
        onNativeInput: (input) => {
          ctx.send({ type: "INPUT.CHANGE", axis: props.axis, value: Number(input.value) })
          return true
        },
      }),
    ),
  )
  const merged = createMemo(() =>
    joinHandlers(normalizeProps(ctx.api().input(props.axis)), {
      onKeyDown: (e: KeyboardEvent) => {
        const event = colorAreaKeyEvent(describeKey(e, env), {
          dir: untrack(ctx.dir),
          dragging: ctx.state.dragging,
        })
        if (!event || e.defaultPrevented) return
        e.preventDefault()
        // Escape ends the drag only: a surrounding layer stays open.
        if (event.type === "DRAG.CANCEL") e.stopPropagation()
        ctx.send(event)
      },
      onFocusIn: (e: FocusEvent) =>
        ctx.send({ ...focusEvent(e.currentTarget as Element, env.modality), axis: props.axis }),
      onFocusOut: () => ctx.send({ ...blurEvent(env.modality), axis: props.axis }),
    }),
  )
  const setEl = (el: Element) => {
    ctx.inputs[props.axis] = el instanceof HTMLInputElement ? el : null
  }
  return <input {...merged()} ref={setEl} />
}

/** The handle: positioned from the value; renders the x and y inputs. */
function Thumb(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useArea("Thumb")
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().thumb()), ref: ctx.setThumb }, rest),
  )
  const children = () => (
    <>
      {resolveChildren(local.children, ctx.state)}
      <AxisInput axis="x" />
      <AxisInput axis="y" />
    </>
  )
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export const ColorArea = { Root, Background, Thumb }
export { Background, Thumb }
