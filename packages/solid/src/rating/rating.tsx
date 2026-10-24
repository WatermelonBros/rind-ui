/** @jsxImportSource solid-js */
// Rating parts: wiring only. The machine owns the value, connect every attribute. Here the
// range input and the form carrier are reached for property sync, reset and native adoption,
// and a star's pointer position is measured into the fraction the machine reads.
import {
  blurEvent,
  type ChangeDetails,
  describeKey,
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
    rating: RatingMessages
  }
}

export interface RatingState {
  readonly value: number
  /** The hover preview, or null. */
  readonly preview: number | null
  readonly count: number
  readonly disabled: boolean
  readonly readOnly: boolean
}

interface Ctx {
  readonly instance: Accessor<string>
  readonly api: Accessor<ReturnType<typeof ratingConnect>>
  readonly state: RatingState
  readonly send: (e: RatingEvent) => void
  readonly registry: ReturnType<typeof usePartRegistry<"label">>
  readonly input: Accessor<Element | null>
  readonly setInput: (el: Element | null) => void
  readonly setCarrier: (el: Element | null) => void
  readonly setControl: (el: Element | null) => void
  readonly inField: boolean
  readonly dir: Accessor<"ltr" | "rtl">
}
const RatingContext = createContext<Ctx>()
function useRating(part: string): Ctx {
  const ctx = useContext(RatingContext)
  if (!ctx) throw new Error(`Rating.${part} must be inside Rating.Root`)
  return ctx
}

export type RatingRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "id" | "dir" | "defaultValue"
> & {
  /** Controlled value: 0 (no rating) to `count`, in steps of 1 (0.5 with `allowHalf`). */
  readonly value?: number | undefined
  /** Read at creation (default 0, no rating); a later change only changes what a form reset restores. */
  readonly defaultValue?: number | undefined
  readonly onValueChange?:
    | ((value: number, details: ChangeDetails<RatingEvent>) => void)
    | undefined
  /** The number of stars. Default: 5. */
  readonly count?: number | undefined
  /** Half stars: the left half of a star (the right one in RTL) and the keys move by 0.5. */
  readonly allowHalf?: boolean | undefined
  /** Pressing the current value, or the keys below the first star, go back to 0 (no rating). */
  readonly allowClear?: boolean | undefined
  /** Ignores all input; the Rating leaves the tab order. */
  readonly disabled?: boolean | undefined
  /** Keeps focus and value, ignores changes. */
  readonly readOnly?: boolean | undefined
  /** The form is invalid while there is no rating (the browser's own message). */
  readonly required?: boolean | undefined
  /** Sets `aria-invalid` and `data-invalid`. */
  readonly invalid?: boolean | undefined
  /** The submitted field name ("" while unrated). */
  readonly name?: string | undefined
  /** The id of the form the inputs belong to. */
  readonly form?: string | undefined
  /** Locale for the value text. Default: the provider's. */
  readonly locale?: string | undefined
  /** Reading direction; mirrors the stars and the arrow keys. Default: the provider's. */
  readonly dir?: "ltr" | "rtl" | undefined
  readonly messages?: Partial<RatingMessages> | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<RatingState> | undefined
  readonly children?: JSX.Element | ((state: RatingState) => JSX.Element)
}

/** A star rating: one native range input (role slider) over decorative stars. */
function Root(props: RatingRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "count",
    "allowHalf",
    "allowClear",
    "disabled",
    "readOnly",
    "required",
    "invalid",
    "name",
    "form",
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
  const messages = useMessages("rating", ratingMessages, () => local.messages)
  const binding = useFieldControl()
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const registry = usePartRegistry<"label">({ scope: "rating", root: instance() })
  const ownLabel = useRenderedId(registry, "label")
  const rangeProps = () => ({
    count: local.count,
    allowHalf: local.allowHalf,
    allowClear: local.allowClear,
  })
  const range = createMemo(() => ratingRange(rangeProps()))
  // Normalised once, at creation; later defaults change a reset only.
  const creationDefault = normalizeRating(
    untrack(() => local.defaultValue),
    untrack(range),
  )
  const [input, setInput] = createSignal<Element | null>(null)
  const [carrier, setCarrier] = createSignal<Element | null>(null)
  const [control, setControl] = createSignal<Element | null>(null)
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
      },
      binding?.() ?? null,
    ),
  )
  const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)
  const rangeInput = hiddenFormInput({ input: () => asInput(input()) }, env)
  const carrierInput = hiddenFormInput(
    { input: () => asInput(carrier()), control: () => asInput(input()) },
    env,
  )
  const sync = (v: number, dispatch: boolean) => {
    rangeInput.sync({ value: String(v) }, { dispatch: false })
    carrierInput.sync({ value: ratingFormValue(v) }, { dispatch })
  }
  const focusInput = (modality: Modality) => {
    const el = asInput(input())
    if (el) void focusSafely(el, env, "programmatic", modality)
  }
  let lastReason: string | null = null
  const machineProps = () => ({
    value: local.value,
    defaultValue: local.defaultValue ?? creationDefault,
    ...rangeProps(),
    disabled: field().disabled,
    readOnly: field().readOnly,
    onValueChange: (next: number, details: ChangeDetails<RatingEvent>) => {
      lastReason = details.reason
      // Uncontrolled: the inputs already show the value when the consumer runs (a
      // requestSubmit() there submits it); a cancel re-syncs them ($reverted).
      if (local.value === undefined) sync(next, false)
      local.onValueChange?.(next, details)
    },
  })
  const { view, send } = useMachine(ratingMachine, machineProps, { inputs: { sync }, focusInput })
  const current = () => resolveRating(machineProps(), view().values.value).value
  const focused = () => view().context.focused
  const modality = useModality(env.modality, focused)
  const api = createMemo(() => {
    const i = instance()
    return ratingConnect({
      instance: i,
      dir: locale().dir,
      value: current(),
      preview: view().context.preview,
      range: range(),
      field: field(),
      fieldData: binding?.().data,
      focused: focused(),
      modality: modality(),
      ids: {
        root: i,
        label: partId("rating", i, "label"),
        input: partId("rating", i, "input"),
        hiddenInput: partId("rating", i, "hidden-input"),
      },
      labelledBy: binding?.().ids.label ?? ownLabel(),
      locale: locale().locale,
      messages: messages(),
      form: local.form,
      defaultValue: normalizeRating(local.defaultValue ?? creationDefault, range()),
    })
  })
  afterMount(() => {
    // The inputs show the value (hydration, a parent's change); no events.
    createEffect(() => {
      const latest = current()
      input()
      carrier()
      rangeInput.sync({ value: String(latest) }, { dispatch: false })
      carrierInput.sync({ value: ratingFormValue(latest) }, { dispatch: false })
    })
    const node = untrack(control) ?? untrack(input)
    if (node) {
      const w = watchFieldsetDisabled(node, setFieldsetDom)
      setFieldsetDom(w.disabled)
      onCleanup(w.stop)
    }
    // Reset (through the carrier) and native adoption (assistive technology on the range input).
    onCleanup(
      carrierInput.track({
        onReset: () => send({ type: "RESET" }),
        current: () => ({ value: ratingFormValue(untrack(current)) }),
      }),
    )
    onCleanup(
      rangeInput.track({
        onReset: () => {},
        resetsWithForm: false,
        current: () => ({ value: String(untrack(current)) }),
        onNativeInput: (el) => {
          send({ type: "INPUT.CHANGE", value: Number(el.value) })
          return true
        },
      }),
    )
    // field-control: one control; the carrier is its validity element, the range input its focus.
    if (binding) {
      const id = partId("rating", untrack(instance), "input")
      onCleanup(
        untrack(() =>
          binding().register(
            {
              id,
              labelable: false,
              focus: focusInput,
              validityElement: () => asInput(carrier()),
              value: () => untrack(current),
            },
            id,
          ),
        ),
      )
    }
    createEffect(
      on(
        current,
        (now) => {
          const user = lastReason !== null && lastReason !== "RESET"
          lastReason = null
          untrack(() => {
            binding?.().report({ type: "change", value: now, user, composing: false })
            if (user) binding?.().report({ type: "commit" })
          })
        },
        { defer: true },
      ),
    )
  })
  const state = reactive<RatingState>(() => ({
    value: current(),
    preview: view().context.preview,
    count: range().count,
    disabled: field().disabled,
    readOnly: field().readOnly,
  }))
  const merged = createMemo(() => mergeProps(normalizeProps(api().root()), rest))
  const children = () => resolveChildren(local.children, state)
  return (
    <RatingContext.Provider
      value={{
        instance,
        api,
        state,
        send,
        registry,
        input,
        setInput,
        setCarrier,
        setControl,
        inField: binding !== null,
        dir: () => locale().dir,
      }}
    >
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </RatingContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<RatingState> | undefined
  readonly children?: JSX.Element | ((state: RatingState) => JSX.Element)
}

/** The visible name; a press focuses the range input (Safari does not, from a label). */
function Label(props: PartProps<JSX.LabelHTMLAttributes<HTMLLabelElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useRating("Label")
  const env = useEnvironment()
  useRegisterPart(ctx.registry, "label", () => partId("rating", ctx.instance(), "label"))
  afterMount(() => {
    if (ctx.inField) warnOwnLabelInField("rating")
  })
  const target = () => {
    const el = ctx.input()
    return el instanceof HTMLInputElement && !el.disabled ? el : null
  }
  const interaction = normalizeProps(
    labelInteraction(env, {
      target,
      forwardsFocus: () => true,
      // A pointer press: no focus ring.
      focusTarget: () => {
        const el = target()
        if (el) void focusSafely(el, env, "programmatic", "pointer")
      },
    }),
  )
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().label()), ...interaction }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: `for` names the range input
    <label {...p}>{children()}</label>
  ))
}

/**
 * The stars' row and the pointer surface; renders the range input and the form carrier after
 * its children. Leaving it ends the hover preview.
 */
function Control(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useRating("Control")
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before the input's focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const inputProps = createMemo(() =>
    joinHandlers(normalizeProps(ctx.api().input()), {
      onKeyDown: (e: KeyboardEvent) => {
        const event = ratingKeyEvent(describeKey(e, env), {
          dir: ctx.dir(),
          platform: env.platform,
        })
        if (!event || e.defaultPrevented) return
        // Neither the native input nor the page reacts (RX#1054, KB#293).
        e.preventDefault()
        ctx.send(event)
      },
      onFocusIn: (e: FocusEvent) => {
        if (e.currentTarget instanceof Element) ctx.send(focusEvent(e.currentTarget, env.modality))
      },
      onFocusOut: () => ctx.send(blurEvent(env.modality)),
    }),
  )
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().control()), {
          onPointerLeave: () => ctx.send({ type: "POINTER.LEAVE" }),
        }),
        ref: ctx.setControl,
      },
      rest,
    ),
  )
  const children = (): JSX.Element => (
    <>
      {resolveChildren(local.children, ctx.state)}
      <input {...inputProps()} ref={ctx.setInput} />
      <input {...normalizeProps(ctx.api().hiddenInput())} ref={ctx.setCarrier} />
    </>
  )
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type RatingItemProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>> & {
  /** The star's position, 1 to `count` (known on the server). */
  readonly index: number
}

/** One star: `data-state` full, half or empty; hidden from assistive technology. */
function Item(props: RatingItemProps) {
  const [local, rest] = splitProps(props, ["index", "render", "children"])
  const ctx = useRating("Item")
  let released = false
  const fraction = (e: { currentTarget: EventTarget | null; clientX: number }) =>
    e.currentTarget instanceof Element
      ? ratingFraction(e.currentTarget.getBoundingClientRect(), e.clientX, ctx.dir())
      : 1
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().item(local.index)), {
        onPointerMove: (e: PointerEvent) => {
          // No hover on touch: a tap sets the value directly.
          if (e.pointerType === "touch") return
          ctx.send({ type: "POINTER.MOVE", index: local.index, fraction: fraction(e) })
        },
        // The range input keeps focus: a press on a star must not blur it.
        onPointerDown: (e: PointerEvent) => e.preventDefault(),
        // Activation on release, where the pointer is: a tap, a click, or a half of a star.
        onPointerUp: (e: PointerEvent) => {
          if (e.button !== 0) return
          released = true
          ctx.send({
            type: "PRESS",
            index: local.index,
            fraction: fraction(e),
            modality: e.pointerType === "touch" ? "touch" : "pointer",
          })
        },
        // A bare click (assistive technology, a script): no pointer before it, a whole star.
        onClick: (e: MouseEvent) => {
          // The click that follows a release is that release's (already pressed).
          const after = released
          released = false
          if (after || e.detail !== 0) return
          ctx.send({ type: "PRESS", index: local.index, fraction: 1, modality: "virtual" })
        },
      }),
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The parts, by name: `rating.parts.ts` re-exports them as the `Rating` namespace. */
export { Control, Item, Label, Root }
