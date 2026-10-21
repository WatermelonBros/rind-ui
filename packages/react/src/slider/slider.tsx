"use client"

// Slider parts: wiring only. The machine owns the value (always an array), connect every
// attribute. Here the consumer's shape (`number` or array) is converted at the boundary, the
// thumb inputs are reached for property sync, reset and native adoption, and the Control's
// press is measured once by pointer-drag.

import {
  blurEvent,
  type ChangeDetails,
  describeKey,
  type FieldControlBinding,
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
import { useFieldControl } from "../field/field"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    slider: SliderMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** A single value, or one value per thumb. */
export type SliderValue = number | readonly number[]

/** The value in the shape the consumer passed. */
export type SliderShaped<V extends SliderValue> = V extends number ? number : readonly number[]

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
  readonly instance: string
  readonly api: ReturnType<typeof sliderConnect>
  readonly state: SliderState
  readonly send: (e: SliderEvent) => void
  readonly registry: ReturnType<typeof usePartRegistry<"label" | "description">>
  readonly inputs: { current: (HTMLInputElement | null)[] }
  readonly thumbs: { current: (HTMLElement | null)[] }
  readonly control: { current: HTMLElement | null }
  readonly latest: { current: readonly number[] }
  readonly formInput: (index: number) => FormInput
  readonly focusThumb: (index: number, modality: Modality) => void
  readonly setThumbDisabled: (index: number, disabled: boolean | undefined) => void
  readonly press: (e: PointerEvent<HTMLElement>) => void
  readonly binding: FieldControlBinding | null
  readonly orientation: SliderOrientation
  readonly dir: "ltr" | "rtl"
}

const SliderContext = createContext<Ctx | null>(null)

/**
 * Internal (not exported from the package): set by Color Slider, whose Root is the pointer
 * surface when there is no Control. A plain Slider's Root never starts a drag.
 */
export const SliderRootSurface = createContext(false)
/**
 * Internal (not exported from the package): set by a component that renders a Slider as its
 * part (Color Picker's channel slider): the host's scope and part names.
 */
export const SliderNaming = createContext<PartNaming<SliderPart> | null>(null)
function useSlider(part: string): Ctx {
  const ctx = useContext(SliderContext)
  if (!ctx) throw new Error(`Slider.${part} must be inside Slider.Root`)
  return ctx
}

const toArray = (v: SliderValue | undefined): readonly number[] | undefined =>
  v === undefined ? undefined : typeof v === "number" ? [v] : v

export type SliderRootProps<V extends SliderValue = SliderValue> = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir"
> & {
  /** The slider's parts: label, control, thumbs, markers, value text and description. */
  readonly children?: ReactNode
  readonly value?: V
  /** Read at creation (default `min`); a later change only changes what a form reset restores. */
  readonly defaultValue?: V
  readonly onValueChange?: (value: SliderShaped<V>, details: SliderChangeDetails) => void
  /** Once at the end of each interaction that changed the value (release, key, adjustment). */
  readonly onValueCommit?: (value: SliderShaped<V>, details: SliderCommitDetails) => void
  readonly min?: number
  readonly max?: number
  readonly step?: number
  /** Shift + arrow and PageUp / PageDown (default one tenth of the range). */
  readonly largeStep?: number
  readonly minStepsBetweenThumbs?: number
  readonly thumbCollision?: ThumbCollision
  /** `contain` keeps thumbs inside the track; set `--rind-slider-thumb-size` to the thumb size. Default: `center`. */
  readonly thumbAlignment?: ThumbAlignment
  /** The axis. Default: `horizontal`. */
  readonly orientation?: SliderOrientation
  /** Ignores all input; thumbs leave the tab order. */
  readonly disabled?: boolean
  /** Keeps focus and value, ignores changes. */
  readonly readOnly?: boolean
  /** `data-required` only: a range input always has a value. */
  readonly required?: boolean
  /** Sets `aria-invalid` and `data-invalid`. */
  readonly invalid?: boolean
  /** The submitted field name of every thumb. */
  readonly name?: string
  /** The id of the form the inputs belong to. */
  readonly form?: string
  readonly formatOptions?: Intl.NumberFormatOptions
  /** Locale for formatting. Default: the provider's. */
  readonly locale?: string
  /** Reading direction; mirrors a horizontal Slider. Default: the provider's. */
  readonly dir?: "ltr" | "rtl"
  readonly messages?: Partial<SliderMessages>
  /** Another element or a render function receiving the props and the slider's state. */
  readonly render?: RenderProp<SliderState>
}

/** A slider with one native range input per thumb (APG Slider, Multi-Thumb Slider). */
function Root<V extends SliderValue>({
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  min,
  max,
  step,
  largeStep,
  minStepsBetweenThumbs,
  thumbCollision,
  thumbAlignment = "center",
  orientation = "horizontal",
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  formatOptions,
  locale: ownLocale,
  dir: ownDir,
  messages: ownMessages,
  render,
  id,
  ref,
  children,
  ...rest
}: SliderRootProps<V>) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const { locale, dir } = useLocale(ownLocale, ownDir)
  const messages = useMessages("slider", sliderMessages, ownMessages)
  const binding = useFieldControl()
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = useState(false)
  const registry = usePartRegistry<"label" | "description">({ scope: "slider", root: instance })
  const ownLabel = useRenderedId(registry, "label")
  const ownDescription = useRenderedId(registry, "description")
  const scalar = !Array.isArray(value ?? defaultValue)
  const rangeProps = { min, max, step, largeStep, minStepsBetweenThumbs }
  const range = sliderRange(rangeProps)
  // Normalised once, at creation (grid, order, gap: ZG#2488); later defaults change a reset only.
  const [creationDefault] = useState(() =>
    normalizeValues(toArray(defaultValue) ?? [range.min], range, "defaultValue"),
  )
  const valueArray = toArray(value)
  if (valueArray) normalizeValues(valueArray, range, "value") // development warning only
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const thumbs = useRef<(HTMLElement | null)[]>([])
  const control = useRef<HTMLElement | null>(null)
  const rootSurface = useContext(SliderRootSurface)
  const naming = useContext(SliderNaming)
  // Its parts under a host's names when the Slider is another component's part.
  const scopeName = naming?.scope ?? "slider"
  const partNamed = (part: SliderPart) => naming?.part(part) ?? part
  const latest = useRef<readonly number[]>(creationDefault)
  const [thumbDisabled, setThumbDisabledState] = useState<readonly boolean[]>([])
  // Stable: Thumbs report their `disabled` from an effect keyed on it.
  const [setThumbDisabled] = useState(
    () => (index: number, off: boolean | undefined) =>
      setThumbDisabledState((prev) => {
        if ((prev[index] === true) === (off === true)) return prev
        const next = [...prev]
        next[index] = off === true
        return next
      }),
  )
  const field = mergeFieldProps(
    {
      role: "slider",
      labelable: false,
      disabled: disabled || fieldsetContext || fieldsetDom,
      readOnly,
      required,
      invalid,
      name,
      describedBy: ownDescription,
    },
    binding,
  )
  // One hidden-form-input per thumb input (sync, reset, adoption); created on first use.
  const [formInputs] = useState(() => new Map<number, FormInput>())
  const formInput = (index: number) => {
    let cap = formInputs.get(index)
    if (!cap) {
      cap = hiddenFormInput({ input: () => inputs.current[index] ?? null }, env)
      formInputs.set(index, cap)
    }
    return cap
  }
  const focusThumb = (index: number, modality: Modality) => {
    const el = inputs.current[index]
    if (el) void focusSafely(el, env, "programmatic", modality)
  }
  const [drag] = useState(() => pointerDragSession())
  // The machine's environment reads refs, so one object serves every render.
  const [machineEnv] = useState(() => ({
    inputs: {
      sync: (values: readonly number[], dispatch: readonly boolean[]) =>
        values.forEach((v, i) => {
          formInput(i).sync({ value: String(v) }, { dispatch: dispatch[i] === true })
        }),
    },
    drag,
    focusThumb: (index: number, modality: Modality) => focusRef.current(index, modality),
  }))
  const focusRef = useRef(focusThumb)
  focusRef.current = focusThumb
  const texts = (vs: readonly number[]) =>
    thumbValueTexts({ values: vs, locale, formatOptions, messages })
  const shape = (v: readonly number[]) => (scalar ? (v[0] ?? range.min) : v) as SliderShaped<V>
  const lastReason = useRef<SliderReason | null>(null)
  const report = binding?.report
  const machineProps = {
    value: valueArray,
    defaultValue: toArray(defaultValue) ?? creationDefault,
    ...rangeProps,
    thumbCollision,
    disabled: field.disabled,
    readOnly: field.readOnly,
    thumbDisabled,
    onValueChange: (next: readonly number[], details: ChangeDetails<SliderEvent>) => {
      lastReason.current = details.reason
      const before = latest.current
      if (valueArray === undefined) {
        // Uncontrolled: the inputs already show the value when the consumer runs (a
        // requestSubmit() there submits it); a cancel re-syncs them ($reverted).
        const t = texts(next)
        next.forEach((v, i) => {
          formInput(i).sync({ value: String(v) }, { dispatch: false })
          inputs.current[i]?.setAttribute("aria-valuenow", String(v))
          const text = t[i]
          if (text !== undefined) inputs.current[i]?.setAttribute("aria-valuetext", text)
        })
      }
      onValueChange?.(shape(next), {
        reason: details.reason,
        index: Math.max(
          0,
          next.findIndex((v, i) => v !== before[i]),
        ),
        event: details.event,
        cancel: details.cancel,
      })
    },
    onValueCommit: (next: readonly number[], details: SliderCommitDetails) => {
      report?.({ type: "commit" })
      onValueCommit?.(shape(next), details)
    },
  }
  const { view, send } = useMachine(sliderMachine, machineProps, machineEnv)
  const values = resolveSlider(machineProps, view.values.value).values
  latest.current = values
  const focused = view.context.focused
  const modality = useModality(env.modality, focused !== null)
  const dragging = view.matches("dragging")
  const ids = {
    root: instance,
    label: partId("slider", instance, "label"),
    description: partId("slider", instance, "description"),
    input: (i: number) => partId("slider", instance, `input-${i}`),
  }
  const api = sliderConnect({
    instance,
    ...(naming ? { naming } : {}),
    values,
    range,
    orientation,
    dir,
    alignment: thumbAlignment,
    field,
    fieldData: binding?.data,
    thumbDisabled,
    focused,
    modality,
    active: view.context.active,
    draggingThumb: view.context.dragging,
    dragging,
    ids,
    labelledBy: binding?.ids.label ?? ownLabel,
    locale,
    formatOptions,
    messages,
    form,
    defaultValues: normalizeValues(toArray(defaultValue) ?? creationDefault, range),
  })

  // After every commit: each input shows the value (hydration, a parent's change); no events.
  useIsoLayoutEffect(() => {
    latest.current.forEach((v, i) => {
      formInput(i).sync({ value: String(v) }, { dispatch: false })
    })
  })
  useEffect(() => {
    const node = control.current ?? inputs.current[0] ?? null
    if (!node) return
    const watch = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    return watch.stop
  }, [])
  // field-control: one control; the first thumb input is its validity element.
  const register = binding?.register
  const firstInput = ids.input(0)
  useIsoLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: firstInput,
        labelable: false,
        focus: (m) => focusRef.current(0, m),
        validityElement: () => inputs.current[0] ?? null,
        value: () => latest.current,
      },
      firstInput,
    )
  }, [register, firstInput])
  const reported = useRef(values)
  useEffect(() => {
    if (sameNumbers(reported.current, values)) return
    reported.current = values
    const user = lastReason.current !== null && lastReason.current !== "RESET"
    lastReason.current = null
    report?.({ type: "change", value: values, user, composing: false })
  }, [values, report])
  // A touch drag (iOS): no text selection or callout while it lasts (BU#1295).
  const selection = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (dragging) return
    selection.current?.()
    selection.current = null
  }, [dragging])

  const state: SliderState = {
    values,
    dragging,
    disabled: field.disabled,
    readOnly: field.readOnly,
    orientation,
  }
  const ctx: Ctx = {
    instance,
    api,
    state,
    send,
    registry,
    inputs,
    thumbs,
    control,
    latest,
    formInput,
    focusThumb,
    binding,
    orientation,
    dir,
    setThumbDisabled,
    press: (e) => {
      if (!isDragPress(e) || drag.active || field.disabled || field.readOnly) return
      const thumb = (e.target as Element).closest?.(
        `[data-scope="${scopeName}"][data-part="${partNamed("thumb")}"]`,
      )
      // A disabled thumb is no target: the press is a track press there.
      const index =
        thumb &&
        thumb.getAttribute("data-instance") === instance &&
        !thumb.hasAttribute("data-disabled")
          ? Number(thumb.getAttribute("data-index"))
          : null
      const anchor = index === null ? undefined : fractionOf(values[index] ?? range.min, range)
      const contain = thumbAlignment === "contain" ? (thumbs.current[index ?? 0] ?? null) : null
      const fraction = drag.press(e.currentTarget, e.nativeEvent, {
        ...sliderDragAxis({ orientation, dir }, contain),
        anchor,
      })
      // Focus goes to the thumb input (the machine moves it): the browser must not blur it.
      e.preventDefault()
      const touch = e.pointerType === "touch"
      if (touch) selection.current = textSelection(e.currentTarget, env, true)
      send({ type: "POINTER.DOWN", fraction, thumb: index, modality: touch ? "touch" : "pointer" })
    },
  }
  // Color Slider only: without a Control part its Root is the pointer surface; presses that
  // start on the Label or the ValueText do not start a drag.
  const rootPress = (e: PointerEvent<HTMLElement>) => {
    if (!rootSurface || control.current) return
    const from = (e.target as Element).closest?.(`[data-scope="${scopeName}"][data-part]`)
    const partName = from?.getAttribute("data-part")
    if (
      partName === partNamed("label") ||
      partName === partNamed("value-text") ||
      partName === partNamed("description")
    )
      return
    ctx.press(e)
  }
  const props = mergeProps(
    { ...joinHandlers(normalizeProps(api.root()), { onPointerDown: rootPress }), ref },
    rest,
  )
  return (
    <SliderContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </SliderContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the slider's state. */
  readonly render?: RenderProp<SliderState>
}

/** The visible name; a press focuses the first enabled thumb (Safari does not, from a label). */
function Label({ render, ...rest }: PartProps<"label">) {
  const ctx = useSlider("Label")
  const env = useEnvironment()
  useRegisterPart(ctx.registry, "label", partId("slider", ctx.instance, "label"))
  const inField = ctx.binding !== null
  useEffect(() => {
    if (inField) warnOwnLabelInField("slider")
  }, [inField])
  const firstEnabled = () => ctx.inputs.current.find((el) => el && !el.disabled) ?? null
  const interaction = labelInteraction(env, {
    target: firstEnabled,
    forwardsFocus: () => true,
    // A pointer press: no focus ring.
    focusTarget: () => {
      const el = firstEnabled()
      if (el) void focusSafely(el, env, "programmatic", "pointer")
    },
  })
  const props = mergeProps({ ...normalizeProps(ctx.api.label()), ...interaction }, rest)
  return renderPart("label", props, render, ctx.state)
}

/** The formatted value (a range for two thumbs). Not a live region. */
function ValueText({ render, children, ...rest }: PartProps<"div">) {
  const ctx = useSlider("ValueText")
  const { text, ...own } = ctx.api.valueText()
  const props = mergeProps(normalizeProps(own), rest)
  return renderPart("div", { ...props, children: children ?? text }, render, ctx.state)
}

/** The pointer surface: a press moves the nearest thumb there and starts a drag. */
function Control({ render, ref, ...rest }: PartProps<"div">) {
  const ctx = useSlider("Control")
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before the thumb's focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.control()), {
        onPointerDown: (e: PointerEvent<HTMLElement>) => ctx.press(e),
      }),
      ref: composeRefs(ctx.control, ref),
    },
    rest,
  )
  return renderPart("div", props, render, ctx.state)
}

function Track({ render, ...rest }: PartProps<"div">) {
  const ctx = useSlider("Track")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.track()), rest), render, ctx.state)
}

/** The filled range: from the start (one thumb) or between the outer thumbs. */
function Indicator({ render, ...rest }: PartProps<"div">) {
  const ctx = useSlider("Indicator")
  const props = mergeProps(normalizeProps(ctx.api.indicator()), rest)
  return renderPart("div", props, render, ctx.state)
}

export type SliderThumbProps = Omit<PartProps<"div">, "children"> & {
  /** The thumb's value index (known on the server). */
  readonly index: number
  /** Disables this thumb only. */
  readonly disabled?: boolean
  /** Submitted under this name instead of the Root's. */
  readonly name?: string
  /** The thumb's visible content, rendered before its native range input. */
  readonly children?: ReactNode
}

/** One thumb and its native range input (the focusable `slider`). */
function Thumb({
  index,
  disabled,
  name,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  render,
  ref,
  children,
  ...rest
}: SliderThumbProps) {
  const ctx = useSlider("Thumb")
  const env = useEnvironment()
  const { send, setThumbDisabled, formInput, latest } = ctx
  useIsoLayoutEffect(() => {
    setThumbDisabled(index, disabled)
    return () => setThumbDisabled(index, false)
  }, [index, disabled, setThumbDisabled])
  // Reset (once, on the first input), re-sync after it, and native adoption (AT adjusting).
  useEffect(
    () =>
      formInput(index).track({
        onReset: () => send({ type: "RESET" }),
        resetsWithForm: index === 0,
        current: () => ({ value: String(latest.current[index] ?? "") }),
        onNativeInput: (input) => {
          send({ type: "INPUT.CHANGE", thumb: index, value: Number(input.value) })
          return true
        },
      }),
    [formInput, index, send, latest],
  )
  const own = { disabled, ariaLabel, ariaLabelledBy, name }
  const inputProps = joinHandlers(normalizeProps(ctx.api.input(index, own)), {
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      const event = sliderKeyEvent(describeKey(e.nativeEvent, env), index, {
        orientation: ctx.orientation,
        dir: ctx.dir,
        platform: env.platform,
        dragging: ctx.state.dragging,
      })
      if (!event || e.defaultPrevented) return
      // Neither the native input nor the page reacts (RX#1054, KB#293).
      e.preventDefault()
      // Escape ends the drag only: a surrounding layer stays open.
      if (event.type === "DRAG.CANCEL") e.stopPropagation()
      send(event)
    },
    onFocus: (e: { currentTarget: Element }) =>
      send({ ...focusEvent(e.currentTarget, env.modality), thumb: index }),
    onBlur: () => send({ ...blurEvent(env.modality), thumb: index }),
  })
  const props = mergeProps(
    {
      ...normalizeProps(ctx.api.thumb(index, own)),
      ref: composeRefs((el: HTMLElement | null) => {
        ctx.thumbs.current[index] = el
      }, ref),
    },
    rest,
  )
  return renderPart(
    "div",
    {
      ...props,
      children: (
        <>
          {children}
          <input
            {...inputProps}
            ref={(el) => {
              ctx.inputs.current[index] = el
            }}
          />
        </>
      ),
    },
    render,
    ctx.state,
  )
}

/** Decorative tick marks (`aria-hidden`). */
function MarkerGroup({ render, ...rest }: PartProps<"div">) {
  const ctx = useSlider("MarkerGroup")
  const props = mergeProps(normalizeProps(ctx.api.markerGroup()), rest)
  return renderPart("div", props, render, ctx.state)
}

export type SliderMarkerProps = PartProps<"div"> & {
  /** The value the tick marks. */
  readonly value: number
}

/** A tick at `value`: `data-state` under-value, at-value or over-value. */
function Marker({ value, render, ...rest }: SliderMarkerProps) {
  const ctx = useSlider("Marker")
  const props = mergeProps(normalizeProps(ctx.api.marker(value)), rest)
  return renderPart("div", props, render, ctx.state)
}

/** Help text, referenced by every thumb input's `aria-describedby`. */
function Description({ render, ...rest }: PartProps<"div">) {
  const ctx = useSlider("Description")
  useRegisterPart(ctx.registry, "description", partId("slider", ctx.instance, "description"))
  const props = mergeProps(normalizeProps(ctx.api.description()), rest)
  return renderPart("div", props, render, ctx.state)
}

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
