import {
  announcerCapability,
  type ChangeDetails,
  createListCollection,
  hiddenFormInput,
  type ItemRegistry,
  implicitSubmit,
  isImeKey,
  layoutCapability,
  type RadioGroupEvent,
  radioGroupMachine,
  segmentedControlConnect,
  segmentedControlIds,
  toKey,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
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
} from "vue"
import { changeEmitter } from "../emit-change"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { declaredStop, useCollectionItems, useRegisterItem } from "../use-collection-items"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"
import { useSelectionIndicator } from "../use-selection-indicator"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

interface Ctx {
  readonly instance: () => string
  readonly api: (pendingStop?: string | null) => ReturnType<typeof segmentedControlConnect>
  readonly send: (event: RadioGroupEvent) => void
  readonly registry: ItemRegistry
  readonly collection: () => unknown
  readonly parts: PartRegistry<"label">
  readonly ids: () => ReturnType<typeof segmentedControlIds>
  readonly value: () => string | null
  readonly disabled: () => boolean
  /** A user change waiting for its commit: that segment's input dispatches input + change. */
  readonly pending: { current: string | null }
  readonly stop: ReturnType<typeof declaredStop>
}
const ControlKey: InjectionKey<Ctx> = Symbol("rind-ui.segmented-control")
function useControl(part: string): Ctx {
  const ctx = inject(ControlKey, null)
  if (!ctx) throw new Error(`SegmentedControl.${part} must be inside SegmentedControl.Root`)
  return ctx
}

export interface SegmentedControlState {
  readonly value: string | null
  readonly disabled: boolean
}
export interface SegmentState {
  readonly checked: boolean
  readonly disabled: boolean
}

const Root = defineComponent({
  name: "SegmentedControlRoot",
  inheritAttrs: false,
  props: {
    /** Controlled value (`v-model`). */
    modelValue: { type: [String, null] as PropType<string | null>, default: undefined },
    defaultValue: { type: [String, null] as PropType<string | null>, default: undefined },
    /** `aria-orientation`, `data-orientation` and the indicator only: every arrow key moves. */
    orientation: { type: String as PropType<"horizontal" | "vertical">, default: "horizontal" },
    disabled: Boolean,
    focusableWhenDisabled: Boolean,
    readonly: Boolean,
    required: Boolean,
    invalid: Boolean,
    /** Default: derived from the root id. */
    name: String,
    form: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: string | null, _details: ChangeDetails<RadioGroupEvent>) => true,
    "update:modelValue": (_value: string | null) => true,
  },
  slots: Object as SlotsType<{ default?: (state: SegmentedControlState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    const instance = useRootId(() => props.id)
    const ids = computed(() => segmentedControlIds(instance()))
    const fieldsetContext = useFieldsetDisabled()
    const fieldsetDom = shallowRef(false)
    const groupDisabled = () => props.disabled || fieldsetContext.value || fieldsetDom.value
    const { collection: registered, registry } = useCollectionItems()
    const collection = () => registered.value ?? EMPTY
    const pending = { current: null as string | null }
    const emitChange = changeEmitter<string | null, RadioGroupEvent>(
      (v, d) => emit("valueChange", v, d),
      (v) => emit("update:modelValue", v),
    )
    const { view, send } = useMachine(
      radioGroupMachine,
      () => ({
        collection: collection(),
        strategy: "roving" as const,
        ids: ids.value,
        loop: true,
        selectionMode: "single" as const,
        focusableWhenDisabled: props.focusableWhenDisabled,
        value: props.modelValue,
        defaultValue: props.defaultValue,
        // A user change (an arrow or a press) is dispatched on that segment's input after update.
        onValueChange: (next: string | null, details: ChangeDetails<RadioGroupEvent>) => {
          if (details.reason === "NAVIGATE" || details.reason === "PRESS") pending.current = next
          emitChange(next, details)
        },
        disabled: groupDisabled(),
        readOnly: props.readonly,
      }),
      env,
    )
    const current = () => view.value.values.value ?? null
    // The Label is expected unless aria-label names the control: the server HTML then already
    // labels the root (base-ui#5597).
    const parts = usePartRegistry<"label">({
      scope: "segmented-control",
      root: instance(),
      ...(attrs["aria-label"] === undefined ? { expected: ["label"] as const } : {}),
    })
    const labelRendered = useRenderedId(parts, "label")
    const api = (pendingStop: string | null = null) =>
      segmentedControlConnect(
        {
          instance: instance(),
          collection: collection(),
          value: current(),
          highlightedKey: view.value.context.highlightedKey,
          highlightSource: view.value.context.highlightSource,
          pending: registered.value === null,
          pendingStop,
          orientation: props.orientation,
          disabled: groupDisabled(),
          focusableWhenDisabled: props.focusableWhenDisabled,
          readOnly: props.readonly,
          required: props.required,
          invalid: props.invalid,
          name: props.name,
          form: props.form,
          labelRendered: labelRendered.value,
          ariaLabel: attrs["aria-label"] as string | undefined,
          indicator: view.value.context.indicator,
        },
        send,
        env,
      )
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      const node = el.value
      if (!node) return
      const w = watchFieldsetDisabled(node, (d) => (fieldsetDom.value = d))
      fieldsetDom.value = w.disabled
      // A form reset is answered once, by the control (every segment's input re-syncs).
      const doc = node.ownerDocument
      const onReset = (e: Event) => {
        if (e.defaultPrevented) return
        const input = node.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
        if (input && e.target === input.form) send({ type: "RESET" })
      }
      doc.addEventListener("reset", onReset)
      onBeforeUnmount(() => {
        w.stop()
        doc.removeEventListener("reset", onReset)
      })
    })
    const settle = () => {
      // After the segments' updates: a proposal the parent refused never dispatches later.
      if (pending.current !== null && pending.current !== current()) pending.current = null
      // Development: a radiogroup needs a name (Label, aria-label or aria-labelledby).
      const node = el.value
      if (process.env.NODE_ENV === "production" || !node) return
      if (!node.getAttribute("aria-labelledby") && !node.getAttribute("aria-label")) {
        console.warn(
          `[rind-ui] segmented-control: #${node.id} has no accessible name; render SegmentedControl.Label or pass aria-label`,
        )
      }
    }
    onMounted(settle)
    onUpdated(settle)
    provide(ControlKey, {
      instance,
      api,
      send,
      registry,
      collection: () => registered.value,
      parts,
      ids: () => ids.value,
      value: current,
      disabled: groupDisabled,
      pending,
      stop: declaredStop(),
    })
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(api().root()), ref: refTo(el) }, attrs),
        slots.default?.({ value: current(), disabled: groupDisabled() }),
        props.asChild,
      )
  },
})

/** Not a <label>: a radiogroup is not labelable. */
const Label = defineComponent({
  name: "SegmentedControlLabel",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const ctx = useControl("Label")
    useRegisterPart(ctx.parts, "label", () => ctx.ids().label)
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().label()), attrs),
        slots["default"]?.(),
        props.asChild,
      )
  },
})

const Item = defineComponent({
  name: "SegmentedControlItem",
  inheritAttrs: false,
  props: {
    /** The segment's value: what the control's value and the form submit. */
    value: { type: String, required: true },
    /** Disables this segment: it cannot be checked. */
    disabled: Boolean,
    /** The text for the collection (defaults to the segment's text content). */
    textValue: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: SegmentState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = useControl("Item")
    const env = useEnvironment()
    // The modality tracker must see the pointerdown that comes before focus.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const key = () => toKey(props.value)
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    useRegisterItem(
      ctx.registry,
      () => ({ key: props.value, textValue: props.textValue, disabled: props.disabled }),
      el,
    )
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const isDisabled = () => ctx.disabled() || props.disabled
    const press = usePress({
      env,
      send: (e) => {
        if (e.type === "PRESS") ctx.send({ type: "PRESS", key: key(), modality: e.modality })
      },
      disabled: isDisabled,
    })
    const hover = useHover({ env, send: () => {}, disabled: isDisabled })
    const inputEl = shallowRef<HTMLInputElement | null>(null)
    const checked = () => ctx.value() === key()
    const formInput = hiddenFormInput(
      { input: () => inputEl.value, control: () => el.value as HTMLElement | null },
      env,
    )
    // Read once, in document order: this segment's view of the server tab stop.
    const pendingStop = ctx.stop(
      props.value,
      isDisabled(),
      ctx.value() === null ? [] : [ctx.value() as string],
    )
    // After every update: the input mirrors the value; the newly checked one, after a user
    // change, dispatches input + change (programmatic changes stay silent).
    const sync = () => {
      measured.value = el.value?.tagName.toLowerCase() ?? null
      const dispatch = checked() && ctx.pending.current === key()
      formInput.sync({ checked: checked() }, { dispatch })
      if (dispatch) ctx.pending.current = null
      // Development: a segment needs a name (text content or aria-label).
      const node = el.value
      if (process.env.NODE_ENV === "production" || !node) return
      const named =
        (node.textContent ?? "").trim() !== "" ||
        node.getAttribute("aria-label") ||
        node.getAttribute("aria-labelledby")
      if (!named) {
        console.warn(
          `[rind-ui] segmented-control: the item "${props.value}" has no text and no aria-label; an icon-only segment needs aria-label`,
        )
      }
    }
    onMounted(() => {
      sync()
      onBeforeUnmount(
        formInput.track({
          onReset: () => {},
          current: () => ({ checked: checked() }),
          // The control answers the reset once; each input only re-syncs.
          resetsWithForm: false,
        }),
      )
    })
    onUpdated(sync)
    return () => {
      const state = { checked: checked(), disabled: isDisabled() }
      const children = slots.default?.(state)
      const own = normalizeProps(
        ctx.api(pendingStop).item(key(), {
          tag: renderedTag("button", children, props.asChild, measured.value),
          focused: focused.value,
          modality: modality.value,
          pressed: press.pressed.value,
          hovered: hover.hovered.value,
          itemDisabled: props.disabled,
        }),
      )
      const merged = mergeProps(
        {
          ...joinHandlers(
            own,
            {
              // Enter submits the form (implicit submission); it never selects.
              onKeydown: (e: KeyboardEvent) => {
                if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
                implicitSubmit(inputEl.value?.form ?? null)
              },
            },
            press.props,
            hover.props,
            { onFocusin: () => (focused.value = true), onFocusout: () => (focused.value = false) },
          ),
          ref: refTo(el),
        },
        attrs,
      )
      return [
        renderPart("button", merged, children, props.asChild),
        // A sibling of the segment, never inside it (reka-ui#1597).
        renderPart(
          "input",
          {
            ...normalizeProps(ctx.api().hiddenInput(key(), { disabled: props.disabled })),
            ref: refTo(inputEl),
          },
          undefined,
        ),
      ]
    }
  },
})

const Indicator = defineComponent({
  name: "SegmentedControlIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{ default?: (state: { readonly visible: boolean }) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = useControl("Indicator")
    const el = shallowRef<Element | null>(null)
    useSelectionIndicator({
      el,
      selectedId: () => {
        const value = ctx.value()
        return value === null ? null : ctx.ids().item(toKey(value))
      },
      itemSelector: `[data-part="item"][data-instance="${ctx.instance()}"]`,
      collection: ctx.collection,
      onMeasure: (box, cause) => ctx.send({ type: "INDICATOR.MEASURE", box, cause }),
    })
    return () => {
      const merged = mergeProps({ ...normalizeProps(ctx.api().indicator()), ref: refTo(el) }, attrs)
      return renderPart(
        "span",
        merged,
        slots.default?.({ visible: merged["data-state"] === "visible" }),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `segmented-control.parts.ts` re-exports them as the `SegmentedControl` namespace. */
export { Indicator, Item, Label, Root }
