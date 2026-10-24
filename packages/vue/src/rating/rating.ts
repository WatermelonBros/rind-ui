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
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
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
  readonly instance: () => string
  readonly api: () => ReturnType<typeof ratingConnect>
  readonly state: () => RatingState
  readonly send: (e: RatingEvent) => void
  readonly registry: ReturnType<typeof usePartRegistry<"label">>
  readonly input: { value: Element | null }
  readonly carrier: { value: Element | null }
  readonly control: { value: Element | null }
  readonly inField: boolean
  readonly dir: () => "ltr" | "rtl"
}
const RatingKey: InjectionKey<Ctx> = Symbol("rind-ui.rating")
function useRating(part: string): Ctx {
  const ctx = inject(RatingKey, null)
  if (!ctx) throw new Error(`Rating.${part} must be inside Rating.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: RatingState) => VNodeChild }>

/** A star rating: one native range input (role slider) over decorative stars. */
const Root = defineComponent({
  name: "RatingRoot",
  inheritAttrs: false,
  props: {
    /** Controlled value (`v-model`): 0 (no rating) to `count`, in steps of 1 (0.5 with `allowHalf`). */
    modelValue: { type: Number, default: undefined },
    /** Read at creation (default 0, no rating); a later change only changes what a form reset restores. */
    defaultValue: Number,
    /** The number of stars. Default: 5. */
    count: Number,
    /** Half stars: the left half of a star (the right one in RTL) and the keys move by 0.5. */
    allowHalf: { type: Boolean, default: undefined },
    /** Pressing the current value, or the keys below the first star, go back to 0 (no rating). */
    allowClear: { type: Boolean, default: undefined },
    /** Ignores all input; the Rating leaves the tab order. */
    disabled: Boolean,
    /** Keeps focus and value, ignores changes. */
    readonly: Boolean,
    /** The form is invalid while there is no rating (the browser's own message). */
    required: Boolean,
    /** Sets `aria-invalid` and `data-invalid`. */
    invalid: Boolean,
    /** The submitted field name ("" while unrated). */
    name: String,
    /** The id of the form the inputs belong to. */
    form: String,
    /** Locale for the value text. Default: the provider's. */
    locale: String,
    /** Reading direction; mirrors the stars and the arrow keys. Default: the provider's. */
    dir: String as PropType<"ltr" | "rtl">,
    messages: Object as PropType<Partial<RatingMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: number, _details: ChangeDetails<RatingEvent>) => true,
    "update:modelValue": (_value: number) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const locale = useLocale(
      () => props.locale,
      () => props.dir,
    )
    const messages = useMessages("rating", ratingMessages, () => props.messages)
    const binding = useFieldControl()
    const fieldsetContext = useFieldsetDisabled()
    const fieldsetDom = shallowRef(false)
    const registry = usePartRegistry<"label">({ scope: "rating", root: instance() })
    const ownLabel = useRenderedId(registry, "label")
    const rangeProps = () => ({
      count: props.count,
      allowHalf: props.allowHalf,
      allowClear: props.allowClear,
    })
    const range = computed(() => ratingRange(rangeProps()))
    // Normalised once, at creation; later defaults change a reset only.
    const creationDefault = normalizeRating(props.defaultValue, range.value)
    const input = shallowRef<Element | null>(null)
    const carrier = shallowRef<Element | null>(null)
    const control = shallowRef<Element | null>(null)
    let latest = creationDefault
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "slider",
          labelable: false,
          disabled: props.disabled || fieldsetContext.value || fieldsetDom.value,
          readOnly: props.readonly,
          required: props.required,
          invalid: props.invalid,
          name: props.name,
        },
        binding?.value ?? null,
      ),
    )
    const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)
    const rangeInput = hiddenFormInput({ input: () => asInput(input.value) }, env)
    const carrierInput = hiddenFormInput(
      { input: () => asInput(carrier.value), control: () => asInput(input.value) },
      env,
    )
    const sync = (v: number, dispatch: boolean) => {
      rangeInput.sync({ value: String(v) }, { dispatch: false })
      carrierInput.sync({ value: ratingFormValue(v) }, { dispatch })
    }
    const focusInput = (modality: Modality) => {
      const el = asInput(input.value)
      if (el) void focusSafely(el, env, "programmatic", modality)
    }
    let lastReason: string | null = null
    const machineProps = () => ({
      value: props.modelValue,
      defaultValue: props.defaultValue ?? creationDefault,
      ...rangeProps(),
      disabled: field.value.disabled,
      readOnly: field.value.readOnly,
      onValueChange: (next: number, details: ChangeDetails<RatingEvent>) => {
        lastReason = details.reason
        // Uncontrolled: the inputs already show the value when the consumer runs (a
        // requestSubmit() there submits it); a cancel re-syncs them ($reverted).
        if (props.modelValue === undefined) sync(next, false)
        let cancelled = false
        emit("valueChange", next, {
          ...details,
          cancel: () => {
            cancelled = true
            details.cancel()
          },
        })
        if (!cancelled) emit("update:modelValue", next)
      },
    })
    const { view, send } = useMachine(ratingMachine, machineProps, { inputs: { sync }, focusInput })
    const current = () => resolveRating(machineProps(), view.value.values.value).value
    const focused = () => view.value.context.focused
    const modality = useModality(env.modality, focused)
    const api = computed(() => {
      const i = instance()
      return ratingConnect({
        instance: i,
        dir: locale.value.dir,
        value: current(),
        preview: view.value.context.preview,
        range: range.value,
        field: field.value,
        fieldData: binding?.value.data,
        focused: focused(),
        modality: modality.value,
        ids: {
          root: i,
          label: partId("rating", i, "label"),
          input: partId("rating", i, "input"),
          hiddenInput: partId("rating", i, "hidden-input"),
        },
        labelledBy: binding?.value.ids.label ?? ownLabel.value,
        locale: locale.value.locale,
        messages: messages.value,
        form: props.form,
        defaultValue: normalizeRating(props.defaultValue ?? creationDefault, range.value),
      })
    })
    // After every update: the inputs show the value (hydration, a parent's change); no events.
    const show = () => {
      latest = current()
      rangeInput.sync({ value: String(latest) }, { dispatch: false })
      carrierInput.sync({ value: ratingFormValue(latest) }, { dispatch: false })
    }
    onMounted(() => {
      show()
      const node = control.value ?? input.value
      if (node) {
        const w = watchFieldsetDisabled(node, (d) => (fieldsetDom.value = d))
        fieldsetDom.value = w.disabled
        onBeforeUnmount(w.stop)
      }
      // Reset (through the carrier) and native adoption (assistive technology on the range input).
      onBeforeUnmount(
        carrierInput.track({
          onReset: () => send({ type: "RESET" }),
          current: () => ({ value: ratingFormValue(current()) }),
        }),
      )
      onBeforeUnmount(
        rangeInput.track({
          onReset: () => {},
          resetsWithForm: false,
          current: () => ({ value: String(current()) }),
          onNativeInput: (el) => {
            send({ type: "INPUT.CHANGE", value: Number(el.value) })
            return true
          },
        }),
      )
      // field-control: one control; the carrier is its validity element, the range input its focus.
      if (binding) {
        const id = partId("rating", instance(), "input")
        onBeforeUnmount(
          binding.value.register(
            {
              id,
              labelable: false,
              focus: focusInput,
              validityElement: () => asInput(carrier.value),
              value: current,
            },
            id,
          ),
        )
      }
      let reported = current()
      watch(current, (now) => {
        if (reported === now) return
        reported = now
        const user = lastReason !== null && lastReason !== "RESET"
        lastReason = null
        binding?.value.report({ type: "change", value: now, user, composing: false })
        if (user) binding?.value.report({ type: "commit" })
      })
    })
    onUpdated(show)
    const state = (): RatingState => ({
      value: current(),
      preview: view.value.context.preview,
      count: range.value.count,
      disabled: field.value.disabled,
      readOnly: field.value.readOnly,
    })
    provide(RatingKey, {
      instance,
      api: () => api.value,
      state,
      send,
      registry,
      input,
      carrier,
      control,
      inField: binding !== null,
      dir: () => locale.value.dir,
    })
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(api.value.root()), attrs),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

/** The visible name; a press focuses the range input (Safari does not, from a label). */
const Label = defineComponent({
  name: "RatingLabel",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useRating("Label")
    const env = useEnvironment()
    useRegisterPart(ctx.registry, "label", () => partId("rating", ctx.instance(), "label"))
    onMounted(() => {
      if (ctx.inField) warnOwnLabelInField("rating")
    })
    const target = () => {
      const el = ctx.input.value
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
    return () =>
      renderPart(
        "label",
        mergeProps({ ...normalizeProps(ctx.api().label()), ...interaction }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/**
 * The stars' row and the pointer surface; renders the range input and the form carrier after
 * its children. Leaving it ends the hover preview.
 */
const Control = defineComponent({
  name: "RatingControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useRating("Control")
    const env = useEnvironment()
    // The modality tracker must see the pointerdown that comes before the input's focus.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    return () => {
      const api = ctx.api()
      const inputProps = joinHandlers(normalizeProps(api.input()), {
        onKeydown: (e: KeyboardEvent) => {
          const event = ratingKeyEvent(describeKey(e, env), {
            dir: ctx.dir(),
            platform: env.platform,
          })
          if (!event || e.defaultPrevented) return
          // Neither the native input nor the page reacts (RX#1054, KB#293).
          e.preventDefault()
          ctx.send(event)
        },
        onFocusin: (e: FocusEvent) => {
          if (e.currentTarget instanceof Element)
            ctx.send(focusEvent(e.currentTarget, env.modality))
        },
        onFocusout: () => ctx.send(blurEvent(env.modality)),
      })
      const merged = mergeProps(
        {
          ...joinHandlers(normalizeProps(api.control()), {
            onPointerleave: () => ctx.send({ type: "POINTER.LEAVE" }),
          }),
          ref: refTo(ctx.control),
        },
        attrs,
      )
      return renderPart(
        "div",
        merged,
        [
          slots.default?.(ctx.state()),
          h("input", { ...inputProps, ref: refTo(ctx.input) }),
          h("input", { ...normalizeProps(api.hiddenInput()), ref: refTo(ctx.carrier) }),
        ],
        props.asChild,
      )
    }
  },
})

/** One star: `data-state` full, half or empty; hidden from assistive technology. */
const Item = defineComponent({
  name: "RatingItem",
  inheritAttrs: false,
  props: {
    /** The star's position, 1 to `count` (known on the server). */
    index: { type: Number, required: true },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useRating("Item")
    let released = false
    const fraction = (e: { currentTarget: EventTarget | null; clientX: number }) =>
      e.currentTarget instanceof Element
        ? ratingFraction(e.currentTarget.getBoundingClientRect(), e.clientX, ctx.dir())
        : 1
    return () =>
      renderPart(
        "span",
        mergeProps(
          joinHandlers(normalizeProps(ctx.api().item(props.index)), {
            onPointermove: (e: PointerEvent) => {
              // No hover on touch: a tap sets the value directly.
              if (e.pointerType === "touch") return
              ctx.send({ type: "POINTER.MOVE", index: props.index, fraction: fraction(e) })
            },
            // The range input keeps focus: a press on a star must not blur it.
            onPointerdown: (e: PointerEvent) => e.preventDefault(),
            // Activation on release, where the pointer is: a tap, a click, or a half of a star.
            onPointerup: (e: PointerEvent) => {
              if (e.button !== 0) return
              released = true
              ctx.send({
                type: "PRESS",
                index: props.index,
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
              ctx.send({ type: "PRESS", index: props.index, fraction: 1, modality: "virtual" })
            },
          }),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The parts, by name: `rating.parts.ts` re-exports them as the `Rating` namespace. */
export { Control, Item, Label, Root }
