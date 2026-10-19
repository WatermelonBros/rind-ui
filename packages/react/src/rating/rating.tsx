// Rating parts: wiring only. The machine owns the value, connect every attribute. Here the
// range input and the form carrier are reached for property sync, reset and native adoption,
// and a star's pointer position is measured into the fraction the machine reads.

import {
  blurEvent,
  type ChangeDetails,
  describeKey,
  type FieldControlBinding,
  focusEvent,
  focusSafely,
  hiddenFormInput,
  labelInteraction,
  type Modality,
  mergeFieldProps,
  normalizeRating,
  partId,
  type RatingEvent,
  type RatingMessages,
  ratingConnect,
  ratingFormValue,
  ratingFraction,
  ratingKeyEvent,
  ratingMachine,
  ratingMessages,
  ratingRange,
  resolveRating,
  warnOwnLabelInField,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type MouseEvent,
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
    rating: RatingMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface RatingChangeDetails {
  readonly reason: ChangeDetails<RatingEvent>["reason"]
  readonly event: ChangeDetails<RatingEvent>["event"]
  /** Prevents the change (uncontrolled) or refuses it (controlled). */
  cancel(): void
}

export interface RatingState {
  readonly value: number
  /** The hover preview, or null. */
  readonly preview: number | null
  readonly count: number
  readonly disabled: boolean
  readonly readOnly: boolean
}

type FormInput = ReturnType<typeof hiddenFormInput>

interface Ctx {
  readonly instance: string
  readonly api: ReturnType<typeof ratingConnect>
  readonly state: RatingState
  readonly send: (e: RatingEvent) => void
  readonly registry: ReturnType<typeof usePartRegistry<"label">>
  readonly input: { current: HTMLInputElement | null }
  readonly carrier: { current: HTMLInputElement | null }
  readonly control: { current: HTMLElement | null }
  readonly latest: { current: number }
  readonly rangeInput: FormInput
  readonly carrierInput: FormInput
  readonly binding: FieldControlBinding | null
  readonly dir: "ltr" | "rtl"
}

const RatingContext = createContext<Ctx | null>(null)
function useRating(part: string): Ctx {
  const ctx = useContext(RatingContext)
  if (!ctx) throw new Error(`Rating.${part} must be inside Rating.Root`)
  return ctx
}

export type RatingRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir"
> & {
  /** The rating's parts: its Label and a Control holding the Items. */
  readonly children?: ReactNode
  /** Controlled value: 0 (no rating) to `count`, in steps of 1 (0.5 with `allowHalf`). */
  readonly value?: number
  /** Read at creation (default 0, no rating); a later change only changes what a form reset restores. */
  readonly defaultValue?: number
  readonly onValueChange?: (value: number, details: RatingChangeDetails) => void
  /** The number of stars. Default: 5. */
  readonly count?: number
  /** Half stars: the left half of a star (the right one in RTL) and the keys move by 0.5. */
  readonly allowHalf?: boolean
  /** Pressing the current value, or the keys below the first star, go back to 0 (no rating). */
  readonly allowClear?: boolean
  /** Ignores all input; the Rating leaves the tab order. */
  readonly disabled?: boolean
  /** Keeps focus and value, ignores changes. */
  readonly readOnly?: boolean
  /** The form is invalid while there is no rating (the browser's own message). */
  readonly required?: boolean
  /** Sets `aria-invalid` and `data-invalid`. */
  readonly invalid?: boolean
  /** The submitted field name ("" while unrated). */
  readonly name?: string
  /** The id of the form the inputs belong to. */
  readonly form?: string
  /** Locale for the value text. Default: the provider's. */
  readonly locale?: string
  /** Reading direction; mirrors the stars and the arrow keys. Default: the provider's. */
  readonly dir?: "ltr" | "rtl"
  readonly messages?: Partial<RatingMessages>
  /** Another element or a render function receiving the props and the rating's state. */
  readonly render?: RenderProp<RatingState>
}

/** A star rating: one native range input (role slider) over decorative stars. */
function Root({
  value,
  defaultValue,
  onValueChange,
  count,
  allowHalf,
  allowClear,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  locale: ownLocale,
  dir: ownDir,
  messages: ownMessages,
  render,
  id,
  ref,
  children,
  ...rest
}: RatingRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const { locale, dir } = useLocale(ownLocale, ownDir)
  const messages = useMessages("rating", ratingMessages, ownMessages)
  const binding = useFieldControl()
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = useState(false)
  const registry = usePartRegistry<"label">({ scope: "rating", root: instance })
  const ownLabel = useRenderedId(registry, "label")
  const rangeProps = { count, allowHalf, allowClear }
  const range = ratingRange(rangeProps)
  // Normalised once, at creation; later defaults change a reset only.
  const [creationDefault] = useState(() => normalizeRating(defaultValue, range))
  const input = useRef<HTMLInputElement | null>(null)
  const carrier = useRef<HTMLInputElement | null>(null)
  const control = useRef<HTMLElement | null>(null)
  const latest = useRef(creationDefault)
  const field = mergeFieldProps(
    {
      role: "slider",
      labelable: false,
      disabled: disabled || fieldsetContext || fieldsetDom,
      readOnly,
      required,
      invalid,
      name,
    },
    binding,
  )
  const [rangeInput] = useState(() => hiddenFormInput({ input: () => input.current }, env))
  const [carrierInput] = useState(() =>
    hiddenFormInput({ input: () => carrier.current, control: () => input.current }, env),
  )
  const sync = (v: number, dispatch: boolean) => {
    rangeInput.sync({ value: String(v) }, { dispatch: false })
    carrierInput.sync({ value: ratingFormValue(v) }, { dispatch })
  }
  const syncRef = useRef(sync)
  syncRef.current = sync
  const focusInput = (modality: Modality) => {
    const el = input.current
    if (el) void focusSafely(el, env, "programmatic", modality)
  }
  const focusRef = useRef(focusInput)
  focusRef.current = focusInput
  // The machine's environment reads refs, so one object serves every render.
  const [machineEnv] = useState(() => ({
    inputs: { sync: (v: number, dispatch: boolean) => syncRef.current(v, dispatch) },
    focusInput: (modality: Modality) => focusRef.current(modality),
  }))
  const lastReason = useRef<string | null>(null)
  const report = binding?.report
  const machineProps = {
    value,
    defaultValue: defaultValue ?? creationDefault,
    ...rangeProps,
    disabled: field.disabled,
    readOnly: field.readOnly,
    onValueChange: (next: number, details: ChangeDetails<RatingEvent>) => {
      lastReason.current = details.reason
      // Uncontrolled: the inputs already show the value when the consumer runs (a
      // requestSubmit() there submits it); a cancel re-syncs them ($reverted).
      if (value === undefined) sync(next, false)
      onValueChange?.(next, {
        reason: details.reason,
        event: details.event,
        cancel: details.cancel,
      })
    },
  }
  const { view, send } = useMachine(ratingMachine, machineProps, machineEnv)
  const current = resolveRating(machineProps, view.values.value).value
  latest.current = current
  const focused = view.context.focused
  const modality = useModality(env.modality, focused)
  const ids = {
    root: instance,
    label: partId("rating", instance, "label"),
    input: partId("rating", instance, "input"),
    hiddenInput: partId("rating", instance, "hidden-input"),
  }
  const api = ratingConnect({
    instance,
    dir,
    value: current,
    preview: view.context.preview,
    range,
    field,
    fieldData: binding?.data,
    focused,
    modality,
    ids,
    labelledBy: binding?.ids.label ?? ownLabel,
    locale,
    messages,
    form,
    defaultValue: normalizeRating(defaultValue ?? creationDefault, range),
  })

  // After every commit: the inputs show the value (hydration, a parent's change); no events.
  useIsoLayoutEffect(() => {
    rangeInput.sync({ value: String(latest.current) }, { dispatch: false })
    carrierInput.sync({ value: ratingFormValue(latest.current) }, { dispatch: false })
  })
  useEffect(() => {
    const node = control.current ?? input.current
    if (!node) return
    const watch = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    return watch.stop
  }, [])
  // Reset (through the carrier) and native adoption (assistive technology on the range input).
  useEffect(
    () =>
      carrierInput.track({
        onReset: () => send({ type: "RESET" }),
        current: () => ({ value: ratingFormValue(latest.current) }),
      }),
    [carrierInput, send],
  )
  useEffect(
    () =>
      rangeInput.track({
        onReset: () => {},
        resetsWithForm: false,
        current: () => ({ value: String(latest.current) }),
        onNativeInput: (el) => {
          send({ type: "INPUT.CHANGE", value: Number(el.value) })
          return true
        },
      }),
    [rangeInput, send],
  )
  // field-control: one control; the carrier is its validity element, the range input its focus.
  const register = binding?.register
  useIsoLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: ids.input,
        labelable: false,
        focus: (m) => focusRef.current(m),
        validityElement: () => carrier.current,
        value: () => latest.current,
      },
      ids.input,
    )
  }, [register, ids.input])
  const reported = useRef(current)
  useEffect(() => {
    if (reported.current === current) return
    reported.current = current
    const user = lastReason.current !== null && lastReason.current !== "RESET"
    lastReason.current = null
    report?.({ type: "change", value: current, user, composing: false })
    if (user) report?.({ type: "commit" })
  }, [current, report])

  const state: RatingState = {
    value: current,
    preview: view.context.preview,
    count: range.count,
    disabled: field.disabled,
    readOnly: field.readOnly,
  }
  const ctx: Ctx = {
    instance,
    api,
    state,
    send,
    registry,
    input,
    carrier,
    control,
    latest,
    rangeInput,
    carrierInput,
    binding,
    dir,
  }
  const props = mergeProps({ ...normalizeProps(api.root()), ref }, rest)
  return (
    <RatingContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </RatingContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the rating's state. */
  readonly render?: RenderProp<RatingState>
}

/** The visible name; a press focuses the range input (Safari does not, from a label). */
function Label({ render, ...rest }: PartProps<"label">) {
  const ctx = useRating("Label")
  const env = useEnvironment()
  useRegisterPart(ctx.registry, "label", partId("rating", ctx.instance, "label"))
  const inField = ctx.binding !== null
  useEffect(() => {
    if (inField) warnOwnLabelInField("rating")
  }, [inField])
  const target = () => (ctx.input.current && !ctx.input.current.disabled ? ctx.input.current : null)
  const interaction = labelInteraction(env, {
    target,
    forwardsFocus: () => true,
    // A pointer press: no focus ring.
    focusTarget: () => {
      const el = target()
      if (el) void focusSafely(el, env, "programmatic", "pointer")
    },
  })
  const props = mergeProps({ ...normalizeProps(ctx.api.label()), ...interaction }, rest)
  return renderPart("label", props, render, ctx.state)
}

/**
 * The stars' row and the pointer surface; renders the range input and the form carrier after
 * its children. Leaving it ends the hover preview.
 */
function Control({ render, ref, children, ...rest }: PartProps<"div">) {
  const ctx = useRating("Control")
  const env = useEnvironment()
  const { send } = ctx
  // The modality tracker must see the pointerdown that comes before the input's focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const inputProps = joinHandlers(normalizeProps(ctx.api.input()), {
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      const event = ratingKeyEvent(describeKey(e.nativeEvent, env), {
        dir: ctx.dir,
        platform: env.platform,
      })
      if (!event || e.defaultPrevented) return
      // Neither the native input nor the page reacts (RX#1054, KB#293).
      e.preventDefault()
      send(event)
    },
    onFocus: (e: { currentTarget: Element }) => send(focusEvent(e.currentTarget, env.modality)),
    onBlur: () => send(blurEvent(env.modality)),
  })
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.control()), {
        onPointerLeave: () => send({ type: "POINTER.LEAVE" }),
      }),
      ref: composeRefs(ctx.control, ref),
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
          <input {...inputProps} ref={ctx.input} />
          <input {...normalizeProps(ctx.api.hiddenInput())} ref={ctx.carrier} />
        </>
      ),
    },
    render,
    ctx.state,
  )
}

export type RatingItemProps = PartProps<"span"> & {
  /** The star's position, 1 to `count` (known on the server). */
  readonly index: number
}

/** One star: `data-state` full, half or empty; hidden from assistive technology. */
function Item({ index, render, ...rest }: RatingItemProps) {
  const ctx = useRating("Item")
  const { send, dir } = ctx
  const released = useRef(false)
  const fraction = (e: { currentTarget: Element; clientX: number }) =>
    ratingFraction(e.currentTarget.getBoundingClientRect(), e.clientX, dir)
  const props = mergeProps(
    joinHandlers(normalizeProps(ctx.api.item(index)), {
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        // No hover on touch: a tap sets the value directly.
        if (e.pointerType === "touch") return
        send({ type: "POINTER.MOVE", index, fraction: fraction(e) })
      },
      // The range input keeps focus: a press on a star must not blur it.
      onPointerDown: (e: PointerEvent<HTMLElement>) => e.preventDefault(),
      // Activation on release, where the pointer is: a tap, a click, or a half of a star.
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return
        released.current = true
        send({
          type: "PRESS",
          index,
          fraction: fraction(e),
          modality: e.pointerType === "touch" ? "touch" : "pointer",
        })
      },
      // A bare click (assistive technology, a script): no pointer before it, a whole star.
      onClick: (e: MouseEvent<HTMLElement>) => {
        // The click that follows a release is that release's (already pressed).
        const after = released.current
        released.current = false
        if (after || e.detail !== 0) return
        send({ type: "PRESS", index, fraction: 1, modality: "virtual" })
      },
    }),
    rest,
  )
  return renderPart("span", props, render, ctx.state)
}

export const Rating = { Root, Label, Control, Item }
