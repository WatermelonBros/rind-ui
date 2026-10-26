import type { ItemRegistry } from "@rind-ui/core"
import {
  announcerCapability,
  type ChangeDetails,
  type CollectionKey,
  createListCollection,
  layoutCapability,
  type ToggleGroupEvent,
  toggleGroupConnect,
  toggleGroupIds,
  toggleGroupMachine,
  toKey,
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
} from "vue"
import { useCompositeHost, useHostItem } from "../composite-host"
import { changeEmitter } from "../emit-change"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import * as Toggle from "../toggle/toggle.parts"
import { declaredStop, useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

type Connect = typeof toggleGroupConnect
interface Ctx {
  /** The connect output; `pendingStop` for an item still unregistered (server, hydration). */
  readonly api: (pendingStop?: string | null) => ReturnType<Connect>
  readonly send: (event: ToggleGroupEvent) => void
  readonly registry: ItemRegistry
  readonly value: () => readonly string[]
  readonly disabled: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly stop: ReturnType<typeof declaredStop>
}
/** Enough state to read an item's id (the key the host knows it by). */
const NO_STATE = {
  tag: "button",
  itemDisabled: false,
  focused: false,
  modality: "keyboard",
  pressed: false,
  hovered: false,
} as const

const GroupKey: InjectionKey<Ctx> = Symbol("rind-ui.toggle-group")

export interface ToggleGroupState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

const Root = defineComponent({
  name: "ToggleGroupRoot",
  inheritAttrs: false,
  props: {
    /** Controlled value (`v-model`). */
    modelValue: { type: Array as PropType<readonly string[]>, default: undefined },
    defaultValue: { type: Array as PropType<readonly string[]>, default: undefined },
    /** Default `single`: pressing an item replaces the selection. */
    selectionMode: { type: String as PropType<"single" | "multiple">, default: "single" },
    /** The last pressed item cannot be released. */
    disallowEmptySelection: Boolean,
    orientation: { type: String as PropType<"horizontal" | "vertical">, default: "horizontal" },
    /** Arrow moves wrap at both ends (default true). */
    loop: { type: Boolean, default: true },
    disabled: Boolean,
    focusableWhenDisabled: { type: Boolean, default: undefined },
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: readonly string[], _details: ChangeDetails<ToggleGroupEvent>) => true,
    "update:modelValue": (_value: readonly string[]) => true,
  },
  slots: Object as SlotsType<{ default?: (state: ToggleGroupState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    // Hosted by a Toolbar: its disabled state applies, its focusableWhenDisabled unless ours.
    const host = useCompositeHost()
    const focusableWhenDisabled = () =>
      props.focusableWhenDisabled ?? host?.focusableWhenDisabled ?? false
    const instance = useRootId(() => props.id)
    const ids = computed(() => toggleGroupIds(instance()))
    const fieldsetDisabled = useFieldsetDisabled()
    // A native <fieldset disabled> too: the items' buttons are disabled by it (toggle.md RA#9445).
    const fieldsetDom = shallowRef(false)
    const groupDisabled = () =>
      props.disabled || fieldsetDisabled.value || fieldsetDom.value || host?.disabled === true
    const { collection: registered, registry } = useCollectionItems()
    const collection = () => registered.value ?? EMPTY
    const onValueChange = changeEmitter<readonly string[], ToggleGroupEvent>(
      (v, d) => emit("valueChange", v, d),
      (v) => emit("update:modelValue", v),
    )
    const { view, send } = useMachine(
      toggleGroupMachine,
      () => ({
        collection: collection(),
        strategy: "roving" as const,
        ids: ids.value,
        loop: props.loop,
        selectionMode: props.selectionMode,
        disallowEmptySelection: props.disallowEmptySelection,
        focusableWhenDisabled: focusableWhenDisabled(),
        value: props.modelValue,
        defaultValue: props.defaultValue,
        onValueChange,
        disabled: groupDisabled(),
      }),
      env,
    )
    const current = () => view.value.values.value ?? []
    const api = (pendingStop: string | null = null) =>
      toggleGroupConnect(
        {
          instance: instance(),
          collection: collection(),
          value: current(),
          highlightedKey: view.value.context.highlightedKey,
          pending: registered.value === null,
          pendingStop,
          orientation: props.orientation,
          selectionMode: props.selectionMode,
          disabled: groupDisabled(),
          focusableWhenDisabled: focusableWhenDisabled(),
          focusWithin: view.value.matches("focused"),
          hosted: host !== null,
        },
        send,
        env,
      )
    const el = shallowRef<Element | null>(null)
    // Development: a group needs a name (aria-label or aria-labelledby: radix#754).
    const checkName = () => {
      const node = el.value
      if (process.env.NODE_ENV === "production" || !node) return
      if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
        console.warn(
          `[rind-ui] toggle-group: the root #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    }
    onMounted(() => {
      checkName()
      const node = el.value
      if (!node) return
      const watch = watchFieldsetDisabled(node, (d) => (fieldsetDom.value = d))
      fieldsetDom.value = watch.disabled
      onBeforeUnmount(watch.stop)
    })
    onUpdated(checkName)
    provide(GroupKey, {
      api,
      send,
      registry,
      value: current,
      disabled: groupDisabled,
      focusableWhenDisabled,
      stop: declaredStop(),
    })
    return () => {
      const merged = mergeProps({ ...normalizeProps(api().root()), ref: refTo(el) }, attrs)
      return renderPart(
        "div",
        merged,
        slots.default?.({ value: current(), disabled: groupDisabled() }),
        props.asChild,
      )
    }
  },
})

export interface ToggleGroupItemState {
  readonly pressed: boolean
  readonly disabled: boolean
}

/** The pressed state and indicator props an item gives its indicator. */
const ItemKey: InjectionKey<{
  state: () => ToggleGroupItemState
  indicator: () => Record<string | symbol, unknown>
}> = Symbol("rind-ui.toggle-group-item")

const GroupItem = defineComponent({
  name: "ToggleGroupGroupItem",
  inheritAttrs: false,
  props: {
    value: { type: String, required: true },
    disabled: Boolean,
    textValue: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: ToggleGroupItemState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = inject(GroupKey) as Ctx
    const env = useEnvironment()
    // The modality tracker must see the pointerdown that comes before focus.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const key = (): CollectionKey => toKey(props.value)
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    onMounted(() => (measured.value = el.value?.tagName.toLowerCase() ?? null))
    onUpdated(() => (measured.value = el.value?.tagName.toLowerCase() ?? null))
    useRegisterItem(
      ctx.registry,
      () => ({ key: props.value, textValue: props.textValue, disabled: props.disabled }),
      el,
    )
    // Read once, in document order: this item's view of the server tab stop.
    const pendingStop = ctx.stop(props.value, ctx.disabled() || props.disabled, ctx.value())
    // Hosted: the item is also one of the host's controls (navigation and tab stop).
    const host = useCompositeHost()
    const hostKey = () => ctx.api().item(key(), NO_STATE)["id"] as string // set by the connect
    const itemDisabled = () => ctx.disabled() || props.disabled
    useHostItem(
      host,
      () => ({
        id: hostKey(),
        skip: itemDisabled() && !ctx.focusableWhenDisabled(),
        textValue: props.textValue,
      }),
      el,
    )
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const press = usePress({
      env,
      send: (e) => {
        if (e.type === "PRESS") ctx.send({ type: "PRESS", key: key(), modality: e.modality })
      },
      disabled: itemDisabled,
    })
    const hover = useHover({ env, send: () => {}, disabled: itemDisabled })
    const state = (): ToggleGroupItemState => ({
      pressed: ctx.value().includes(key()),
      disabled: itemDisabled(),
    })
    provide(ItemKey, {
      state,
      indicator: () =>
        normalizeProps(ctx.api(pendingStop).itemIndicator(key(), { itemDisabled: props.disabled })),
    })
    return () => {
      const children = slots.default?.(state())
      const tag = renderedTag("button", children, props.asChild, measured.value)
      const hostProps = host
        ? normalizeProps(
            host.itemProps({
              id: hostKey(),
              disabled: itemDisabled(),
              first: host.claimFirst(hostKey()),
            }),
          )
        : {}
      const own = normalizeProps(
        ctx.api(pendingStop).item(key(), {
          tag,
          itemDisabled: props.disabled,
          focused: focused.value,
          modality: modality.value,
          pressed: press.pressed.value,
          hovered: hover.hovered.value,
        }),
      )
      const merged = mergeProps(
        {
          ...joinHandlers(own, hostProps, press.props, hover.props, {
            onFocusin: () => (focused.value = true),
            onFocusout: () => (focused.value = false),
          }),
          ref: refTo(el),
        },
        attrs,
      )
      return renderPart("button", merged, children, props.asChild)
    }
  },
})

/**
 * A toggle: inside `ToggleGroup.Root` an item of the group (`value` is its key); alone, a
 * single toggle button with its own `pressed` state (no group wrapper, no roving).
 */
const Item = defineComponent({
  name: "ToggleGroupItem",
  inheritAttrs: false,
  props: {
    /** The item's key in the group's value. */
    value: String,
  },
  setup(props, { attrs, slots }) {
    const group = inject(GroupKey, null)
    if (group && props.value === undefined) {
      throw new Error("ToggleGroup.Item needs a `value` inside ToggleGroup.Root")
    }
    return () =>
      group
        ? h(GroupItem, { ...attrs, value: props.value as string }, slots)
        : h(Toggle.Root, attrs, slots)
  },
})

/** Decorative: its default slot while the item is pressed, the `fallback` slot otherwise. */
const ItemIndicator = defineComponent({
  name: "ToggleGroupItemIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{
    default?: (state: ToggleGroupItemState) => VNodeChild
    fallback?: (state: ToggleGroupItemState) => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const item = inject(ItemKey, null)
    return () => {
      // A lone item is a single toggle: its own indicator.
      if (!item) return h(Toggle.Indicator, { ...attrs, asChild: props.asChild }, slots)
      const state = item.state()
      const children = state.pressed ? slots.default?.(state) : slots.fallback?.(state)
      return renderPart("span", mergeProps(item.indicator(), attrs), children, props.asChild)
    }
  },
})

/** The parts, by name: `toggle-group.parts.ts` re-exports them as the `ToggleGroup` namespace. */
export { Item, ItemIndicator, Root }
