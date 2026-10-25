/** @jsxImportSource solid-js */
// Slider parts: wiring only. The machine owns the value (always an array), connect every
// attribute. Here the consumer's shape (`number` or array) is converted at the boundary, the
// thumb inputs are reached for property sync, reset and native adoption, and the Control's
// press is measured once by pointer-drag.
import {
  blurEvent,
  type ChangeDetails,
  describeKey,
  focusEvent,
  focusSafely,
  fractionOf,
  hiddenFormInput,
  isDragPress,
  labelInteraction,
  type Modality,
  mergeFieldProps,
  normalizeValues,
  type PartNaming,
  partId,
  pointerDragSession,
  resolveSlider,
  type SliderCommitDetails,
  type SliderEvent,
  type SliderMessages,
  type SliderOrientation,
  type SliderPart,
  type SliderReason,
  sameNumbers,
  sliderConnect,
  sliderDragAxis,
  sliderKeyEvent,
  sliderMachine,
  sliderMessages,
  sliderRange,
  type ThumbAlignment,
  type ThumbCollision,
  textSelection,
  thumbValueTexts,
  warnOwnLabelInField,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  children as resolve,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
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
    slider: SliderMessages
  }
}

/** A single value, or one value per thumb. */
export type SliderValue = number | readonly number[]

export interface SliderChangeDetails {
  readonly reason: SliderReason
  /** The thumb whose value changed (the first, when several did). */
  readonly index: number
  readonly event: ChangeDetails<SliderEvent>["event"]
  /** Prevents the change (uncontrolled) or refuses it (controlled). */
  cancel(): void
}

export interface SliderState {
  readonly values: readonly number[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly orientation: SliderOrientation
}

type FormInput = ReturnType<typeof hiddenFormInput>

interface Ctx {
  readonly instance: Accessor<string>
  readonly api: Accessor<ReturnType<typeof sliderConnect>>
  readonly state: SliderState
  readonly send: (e: SliderEvent) => void
  readonly registry: ReturnType<typeof usePartRegistry<"label" | "description">>
  readonly inputs: (HTMLInputElement | null)[]
  readonly thumbs: (Element | null)[]
  readonly setControl: (el: Element | null) => void
  readonly values: Accessor<readonly number[]>
  readonly formInput: (index: number) => FormInput
  readonly setThumbDisabled: (index: number, disabled: boolean | undefined) => void
  readonly press: (e: PointerEvent) => void
  readonly inField: boolean
  readonly orientation: Accessor<SliderOrientation>
  readonly dir: Accessor<"ltr" | "rtl">
}
const SliderContext = createContext<Ctx>()
/**
 * Internal (not exported from the package): set by Color Slider, whose Root is the pointer
 * surface when there is no Control. A plain Slider's Root never starts a drag.
 */
export const SliderRootSurfaceContext = createContext(false)
/**
 * Internal (not exported from the package): set by a component that renders a Slider as its
 * part (Color Picker's channel slider): the host's scope and part names.
 */
export const SliderNamingContext = createContext<PartNaming<SliderPart> | null>(null)
function useSlider(part: string): Ctx {
  const ctx = useContext(SliderContext)
  if (!ctx) throw new Error(`Slider.${part} must be inside Slider.Root`)
  return ctx
}

const toArray = (v: SliderValue | undefined): readonly number[] | undefined =>
  v === undefined ? undefined : typeof v === "number" ? [v] : v

export type SliderRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "id" | "dir" | "defaultValue"
> & {
  /** Controlled value: a number, or one number per thumb. */
  readonly value?: SliderValue | undefined
  /** Read at creation (default `min`); a later change only changes what a form reset restores. */
  readonly defaultValue?: SliderValue | undefined
  readonly onValueChange?: ((value: SliderValue, details: SliderChangeDetails) => void) | undefined
  /** Once at the end of each interaction that changed the value (release, key, adjustment). */
  readonly onValueCommit?: ((value: SliderValue, details: SliderCommitDetails) => void) | undefined
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly step?: number | undefined
  /** Shift + arrow and PageUp / PageDown (default one tenth of the range). */
  readonly largeStep?: number | undefined
  readonly minStepsBetweenThumbs?: number | undefined
  readonly thumbCollision?: ThumbCollision | undefined
  /** `contain` keeps thumbs inside the track; set `--rind-slider-thumb-size` to the thumb size. Default: `center`. */
  readonly thumbAlignment?: ThumbAlignment | undefined
  /** The axis. Default: `horizontal`. */
  readonly orientation?: SliderOrientation | undefined
  /** Ignores all input; thumbs leave the tab order. */
  readonly disabled?: boolean | undefined
  /** Keeps focus and value, ignores changes. */
  readonly readOnly?: boolean | undefined
  /** `data-required` only: a range input always has a value. */
  readonly required?: boolean | undefined
  /** Sets `aria-invalid` and `data-invalid`. */
  readonly invalid?: boolean | undefined
  /** The submitted field name of every thumb. */
  readonly name?: string | undefined
  /** The id of the form the inputs belong to. */
  readonly form?: string | undefined
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  /** Locale for formatting. Default: the provider's. */
  readonly locale?: string | undefined
  /** Reading direction; mirrors a horizontal Slider. Default: the provider's. */
  readonly dir?: "ltr" | "rtl" | undefined
  readonly messages?: Partial<SliderMessages> | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<SliderState> | undefined
  readonly children?: JSX.Element | ((state: SliderState) => JSX.Element)
}

/** A slider with one native range input per thumb (APG Slider, Multi-Thumb Slider). */
function Root(props: SliderRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "onValueCommit",
    "min",
    "max",
    "step",
    "largeStep",
    "minStepsBetweenThumbs",
    "thumbCollision",
    "thumbAlignment",
    "orientation",
    "disabled",
    "readOnly",
    "required",
    "invalid",
    "name",
    "form",
    "formatOptions",
    "locale",
    "dir",
    "messages",
    "id",
    "render",
    "children",
  ])
  const env = useEnvironment()
  const instance = useRootId(() => local.id)
  const locale = useLocale(
    () => local.locale,
    () => local.dir,
  )
  const messages = useMessages("slider", sliderMessages, () => local.messages)
  const binding = useFieldControl()
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const registry = usePartRegistry<"label" | "description">({ scope: "slider", root: instance() })
  const ownLabel = useRenderedId(registry, "label")
  const ownDescription = useRenderedId(registry, "description")
  const orientation = () => local.orientation ?? "horizontal"
  const alignment = () => local.thumbAlignment ?? "center"
  const scalar = () => !Array.isArray(local.value ?? local.defaultValue)
  const rangeProps = () => ({
    min: local.min,
    max: local.max,
    step: local.step,
    largeStep: local.largeStep,
    minStepsBetweenThumbs: local.minStepsBetweenThumbs,
  })
  const range = createMemo(() => sliderRange(rangeProps()))
  // Normalised once, at creation (grid, order, gap: ZG#2488); later defaults change a reset only.
  const creationDefault = untrack(() =>
    normalizeValues(toArray(local.defaultValue) ?? [range().min], range(), "defaultValue"),
  )
  const inputs: (HTMLInputElement | null)[] = []
  const thumbs: (Element | null)[] = []
  const [control, setControl] = createSignal<Element | null>(null)
  const rootSurface = useContext(SliderRootSurfaceContext)
  const naming = useContext(SliderNamingContext)
  // Its parts under a host's names when the Slider is another component's part.
  const scopeName = naming?.scope ?? "slider"
  const partNamed = (part: SliderPart) => naming?.part(part) ?? part
  let latest: readonly number[] = creationDefault
  const [thumbDisabled, setThumbDisabledList] = createSignal<readonly boolean[]>([])
  const setThumbDisabled = (index: number, off: boolean | undefined) => {
    const prev = untrack(thumbDisabled)
    if ((prev[index] === true) === (off === true)) return
    const next = [...prev]
    next[index] = off === true
    setThumbDisabledList(next)
  }
  const field = createMemo(() =>
    mergeFieldProps(
      {
        role: "slider",
        labelable: false,
        disabled: local.disabled === true || fieldsetContext() || fieldsetDom(),
        readOnly: local.readOnly === true,
        required: local.required === true,
        invalid: local.invalid === true,
        name: local.name,
        describedBy: ownDescription(),
      },
      binding?.() ?? null,
    ),
  )
  // One hidden-form-input per thumb input (sync, reset, adoption); created on first use.
  const formInputs = new Map<number, FormInput>()
  const formInput = (index: number) => {
    let cap = formInputs.get(index)
    if (!cap) {
      cap = hiddenFormInput({ input: () => inputs[index] ?? null }, env)
      formInputs.set(index, cap)
    }
    return cap
  }
  const focusThumb = (index: number, modality: Modality) => {
    const el = inputs[index]
    if (el) void focusSafely(el, env, "programmatic", modality)
  }
  const drag = pointerDragSession()
  const texts = (vs: readonly number[]) =>
    thumbValueTexts({
      values: vs,
      locale: locale().locale,
      formatOptions: local.formatOptions,
      messages: messages(),
    })
  const shape = (v: readonly number[]): SliderValue => (scalar() ? (v[0] ?? range().min) : v)
  let lastReason: SliderReason | null = null
  const machineProps = () => {
    const valueArray = toArray(local.value)
    if (valueArray) normalizeValues(valueArray, range(), "value") // development warning only
    return {
      value: valueArray,
      defaultValue: toArray(local.defaultValue) ?? creationDefault,
      ...rangeProps(),
      thumbCollision: local.thumbCollision,
      disabled: field().disabled,
      readOnly: field().readOnly,
      thumbDisabled: thumbDisabled(),
      onValueChange: (next: readonly number[], details: ChangeDetails<SliderEvent>) => {
        lastReason = details.reason
        const before = latest
        if (local.value === undefined) {
          // Uncontrolled: the inputs already show the value when the consumer runs (a
          // requestSubmit() there submits it); a cancel re-syncs them ($reverted).
          const t = texts(next)
          next.forEach((v, i) => {
            formInput(i).sync({ value: String(v) }, { dispatch: false })
            inputs[i]?.setAttribute("aria-valuenow", String(v))
            const text = t[i]
            if (text !== undefined) inputs[i]?.setAttribute("aria-valuetext", text)
          })
        }
        local.onValueChange?.(shape(next), {
          reason: details.reason,
          index: Math.max(
            0,
            next.findIndex((v, i) => v !== before[i]),
          ),
          event: details.event,
          cancel: () => details.cancel(),
        })
      },
      onValueCommit: (next: readonly number[], details: SliderCommitDetails) => {
        binding?.().report({ type: "commit" })
        local.onValueCommit?.(shape(next), details)
      },
    }
  }
  const { view, send } = useMachine(sliderMachine, machineProps, {
    inputs: {
      sync: (values: readonly number[], dispatch: readonly boolean[]) =>
        values.forEach((v, i) => {
          formInput(i).sync({ value: String(v) }, { dispatch: dispatch[i] === true })
        }),
    },
    drag,
    focusThumb,
  })
  const values = createMemo(() => resolveSlider(machineProps(), view().values.value).values)
  const focused = () => view().context.focused
  const modality = useModality(env.modality, () => focused() !== null)
  const dragging = () => view().matches("dragging")
  const api = createMemo(() => {
    const i = instance()
    return sliderConnect({
      instance: i,
      ...(naming ? { naming } : {}),
      values: values(),
      range: range(),
      orientation: orientation(),
      dir: locale().dir,
      alignment: alignment(),
      field: field(),
      fieldData: binding?.().data,
      thumbDisabled: thumbDisabled(),
      focused: focused(),
      modality: modality(),
      active: view().context.active,
      draggingThumb: view().context.dragging,
      dragging: dragging(),
      ids: {
        root: i,
        label: partId("slider", i, "label"),
        description: partId("slider", i, "description"),
        input: (n: number) => partId("slider", i, `input-${n}`),
      },
      labelledBy: binding?.().ids.label ?? ownLabel(),
      locale: locale().locale,
      formatOptions: local.formatOptions,
      messages: messages(),
      form: local.form,
      defaultValues: normalizeValues(toArray(local.defaultValue) ?? creationDefault, range()),
    })
  })
  // A touch drag (iOS): no text selection or callout while it lasts (BU#1295).
  let selection: (() => void) | null = null
  afterMount(() => {
    // Each input shows the value (hydration, a parent's change); no events.
    createEffect(() => {
      latest = values()
      for (const [i, v] of latest.entries())
        formInput(i).sync({ value: String(v) }, { dispatch: false })
    })
    const node = untrack(control) ?? inputs[0] ?? null
    if (node) {
      const w = watchFieldsetDisabled(node, setFieldsetDom)
      setFieldsetDom(w.disabled)
      onCleanup(w.stop)
    }
    // field-control: one control; the first thumb input is its validity element.
    if (binding) {
      const first = partId("slider", untrack(instance), "input-0")
      onCleanup(
        untrack(() =>
          binding().register(
            {
              id: first,
              labelable: false,
              focus: (m) => focusThumb(0, m),
              validityElement: () => inputs[0] ?? null,
              value: () => untrack(values),
            },
            first,
          ),
        ),
      )
    }
    let reported = untrack(values)
    createEffect(() => {
      const now = values()
      if (sameNumbers(reported, now)) return
      reported = now
      const user = lastReason !== null && lastReason !== "RESET"
      lastReason = null
      untrack(() => binding?.().report({ type: "change", value: now, user, composing: false }))
    })
    createEffect(
      on(
        dragging,
        (d) => {
          if (d) return
          selection?.()
          selection = null
        },
        { defer: true },
      ),
    )
  })
  const state = reactive<SliderState>(() => ({
    values: values(),
    dragging: dragging(),
    disabled: field().disabled,
    readOnly: field().readOnly,
    orientation: orientation(),
  }))
  const press = (e: PointerEvent) => {
    const f = untrack(field)
    if (!isDragPress(e) || drag.active || f.disabled || f.readOnly) return
    const surface = e.currentTarget
    if (!(surface instanceof HTMLElement)) return
    const thumb = (e.target as Element | null)?.closest?.(
      `[data-scope="${scopeName}"][data-part="${partNamed("thumb")}"]`,
    )
    // A disabled thumb is no target: the press is a track press there.
    const index =
      thumb &&
      thumb.getAttribute("data-instance") === untrack(instance) &&
      !thumb.hasAttribute("data-disabled")
        ? Number(thumb.getAttribute("data-index"))
        : null
    const vs = untrack(values)
    const anchor =
      index === null ? undefined : fractionOf(vs[index] ?? untrack(range).min, untrack(range))
    const contain = alignment() === "contain" ? (thumbs[index ?? 0] ?? null) : null
    const fraction = drag.press(surface, e, {
      ...sliderDragAxis(
        { orientation: orientation(), dir: untrack(locale).dir },
        contain instanceof HTMLElement ? contain : null,
      ),
      anchor,
    })
    // Focus goes to the thumb input (the machine moves it): the browser must not blur it.
    e.preventDefault()
    const touch = e.pointerType === "touch"
    if (touch) selection = textSelection(surface, env, true)
    send({ type: "POINTER.DOWN", fraction, thumb: index, modality: touch ? "touch" : "pointer" })
  }
  // Color Slider only: without a Control part its Root is the pointer surface; presses that
  // start on the Label or the ValueText do not start a drag.
  const rootPress = (e: PointerEvent) => {
    if (!rootSurface || untrack(control)) return
    const from = (e.target as Element | null)?.closest?.(`[data-scope="${scopeName}"][data-part]`)
    const partName = from?.getAttribute("data-part")
    if (
      partName === partNamed("label") ||
      partName === partNamed("value-text") ||
      partName === partNamed("description")
    )
      return
    press(e)
  }
  const merged = createMemo(() =>
    mergeProps(joinHandlers(normalizeProps(api().root()), { onPointerDown: rootPress }), rest),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <SliderContext.Provider
      value={{
        instance,
        api,
        state,
        send,
        registry,
        inputs,
        thumbs,
        setControl,
        values,
        formInput,
        setThumbDisabled,
        press,
        inField: binding !== null,
        orientation,
        dir: () => locale().dir,
      }}
    >
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </SliderContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<SliderState> | undefined
  readonly children?: JSX.Element | ((state: SliderState) => JSX.Element)
}

/** The visible name; a press focuses the first enabled thumb (Safari does not, from a label). */
function Label(props: PartProps<JSX.LabelHTMLAttributes<HTMLLabelElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSlider("Label")
  const env = useEnvironment()
  useRegisterPart(ctx.registry, "label", () => partId("slider", ctx.instance(), "label"))
  afterMount(() => {
    if (ctx.inField) warnOwnLabelInField("slider")
  })
  const firstEnabled = () => ctx.inputs.find((el) => el && !el.disabled) ?? null
  const interaction = normalizeProps(
    labelInteraction(env, {
      target: firstEnabled,
      forwardsFocus: () => true,
      // A pointer press: no focus ring.
      focusTarget: () => {
        const el = firstEnabled()
        if (el) void focusSafely(el, env, "programmatic", "pointer")
      },
    }),
  )
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().label()), ...interaction }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: `for` names the first thumb input
    <label {...p}>{children()}</label>
  ))
}

/** The formatted value (a range for two thumbs). Not a live region. */
function ValueText(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSlider("ValueText")
  const parts = createMemo(() => {
    const { text, ...own } = ctx.api().valueText()
    return { text, own }
  })
  const merged = createMemo(() => mergeProps(normalizeProps(parts().own), rest))
  const given = resolve(() => resolveChildren(local.children, ctx.state))
  const children = () => given() ?? parts().text
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The pointer surface: a press moves the nearest thumb there and starts a drag. */
function Control(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSlider("Control")
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before the thumb's focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().control()), { onPointerDown: ctx.press }),
        ref: ctx.setControl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function simplePart(name: string, own: (ctx: Ctx) => Parameters<typeof normalizeProps>[0]) {
  return function SliderPart(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useSlider(name)
    const merged = createMemo(() => mergeProps(normalizeProps(own(ctx)), rest))
    const children = () => resolveChildren(local.children, ctx.state)
    return renderPart(local.render, merged, ctx.state, children, (p) => (
      <div {...p}>{children()}</div>
    ))
  }
}

const Track = simplePart("Track", (ctx) => ctx.api().track())
/** The filled range: from the start (one thumb) or between the outer thumbs. */
const Indicator = simplePart("Indicator", (ctx) => ctx.api().indicator())
/** Decorative tick marks (`aria-hidden`). */
const MarkerGroup = simplePart("MarkerGroup", (ctx) => ctx.api().markerGroup())

export type SliderThumbProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** The thumb's value index (known on the server). */
  readonly index: number
  /** Disables this thumb only. */
  readonly disabled?: boolean | undefined
  /** Submitted under this name instead of the Root's. */
  readonly name?: string | undefined
}

/** One thumb and its native range input (the focusable `slider`). */
function Thumb(props: SliderThumbProps) {
  const [local, rest] = splitProps(props, [
    "index",
    "disabled",
    "name",
    "render",
    "children",
    "aria-label",
    "aria-labelledby",
  ])
  const ctx = useSlider("Thumb")
  const env = useEnvironment()
  afterMount(() => {
    let old: number | undefined
    createEffect(() => {
      const index = local.index
      const disabled = local.disabled
      if (old !== undefined && old !== index) ctx.setThumbDisabled(old, false)
      ctx.setThumbDisabled(index, disabled)
      old = index
    })
    onCleanup(() =>
      ctx.setThumbDisabled(
        untrack(() => local.index),
        false,
      ),
    )
    // Reset (once, on the first input), re-sync after it, and native adoption (AT adjusting).
    createEffect(() => {
      const index = local.index
      onCleanup(
        ctx.formInput(index).track({
          onReset: () => ctx.send({ type: "RESET" }),
          resetsWithForm: index === 0,
          current: () => ({ value: String(untrack(ctx.values)[index] ?? "") }),
          onNativeInput: (input) => {
            ctx.send({ type: "INPUT.CHANGE", thumb: index, value: Number(input.value) })
            return true
          },
        }),
      )
    })
  })
  const own = () => ({
    disabled: local.disabled,
    ariaLabel: local["aria-label"],
    ariaLabelledBy: local["aria-labelledby"],
    name: local.name,
  })
  const inputProps = createMemo(() => {
    const index = local.index
    return joinHandlers(normalizeProps(ctx.api().input(index, own())), {
      onKeyDown: (e: KeyboardEvent) => {
        const event = sliderKeyEvent(describeKey(e, env), index, {
          orientation: ctx.orientation(),
          dir: ctx.dir(),
          platform: env.platform,
          dragging: ctx.state.dragging,
        })
        if (!event || e.defaultPrevented) return
        // Neither the native input nor the page reacts (RX#1054, KB#293).
        e.preventDefault()
        // Escape ends the drag only: a surrounding layer stays open.
        if (event.type === "DRAG.CANCEL") e.stopPropagation()
        ctx.send(event)
      },
      onFocusIn: (e: FocusEvent) => {
        if (e.currentTarget instanceof Element)
          ctx.send({ ...focusEvent(e.currentTarget, env.modality), thumb: index })
      },
      onFocusOut: () => ctx.send({ ...blurEvent(env.modality), thumb: index }),
    })
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(ctx.api().thumb(local.index, own())),
        ref: (node: Element) => {
          ctx.thumbs[untrack(() => local.index)] = node
        },
      },
      rest,
    ),
  )
  const children = (): JSX.Element => (
    <>
      {resolveChildren(local.children, ctx.state)}
      <input
        {...inputProps()}
        ref={(node: HTMLInputElement) => {
          ctx.inputs[untrack(() => local.index)] = node
        }}
      />
    </>
  )
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type SliderMarkerProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** The value the tick marks. */
  readonly value: number
}

/** A tick at `value`: `data-state` under-value, at-value or over-value. */
function Marker(props: SliderMarkerProps) {
  const [local, rest] = splitProps(props, ["value", "render", "children"])
  const ctx = useSlider("Marker")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().marker(local.value)), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** Help text, referenced by every thumb input's `aria-describedby`. */
function Description(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSlider("Description")
  useRegisterPart(ctx.registry, "description", () =>
    partId("slider", ctx.instance(), "description"),
  )
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().description()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type SliderPartProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

/** The parts, by name: `slider.parts.ts` re-exports them as the `Slider` namespace. */
export {
  Control,
  Description,
  Indicator,
  Label,
  Marker,
  MarkerGroup,
  Root,
  Thumb,
  Track,
  ValueText,
}
