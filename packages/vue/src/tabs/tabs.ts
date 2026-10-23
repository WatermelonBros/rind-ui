import {
  announcerCapability,
  type ChangeDetails,
  type CollectionKey,
  createListCollection,
  type InactivePanels,
  layoutCapability,
  observeTabbable,
  type TabsEvent,
  tabsConnect,
  tabsIds,
  tabsMachine,
  toKey,
  untilFound,
} from "@rind-ui/core"
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
  watch,
} from "vue"
import { changeEmitter } from "../emit-change"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import {
  declaredItems,
  serverStop,
  useCollectionItems,
  useRegisterItem,
} from "../use-collection-items"
import { useRootId } from "../use-ids"
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
  readonly api: () => ReturnType<typeof tabsConnect>
  readonly send: (event: TabsEvent) => void
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly instance: () => string
  readonly value: () => string | null
  readonly disabled: () => boolean
  readonly inactivePanels: () => InactivePanels
  readonly orientation: () => "horizontal" | "vertical"
  readonly collection: () => unknown
  /** A panel element is rendered for `key` (aria-controls). */
  readonly registerPanel: (key: string) => () => void
}
const TabsKey: InjectionKey<Ctx> = Symbol("rind-ui.tabs")
function useTabs(part: string): Ctx {
  const ctx = inject(TabsKey, null)
  if (!ctx) throw new Error(`Tabs.${part} must be inside Tabs.Root`)
  return ctx
}

export interface TabsState {
  readonly value: string | null
  readonly orientation: "horizontal" | "vertical"
}

const Root = defineComponent({
  name: "TabsRoot",
  inheritAttrs: false,
  props: {
    /** Controlled selected tab (`v-model`); `null` selects none. */
    modelValue: { type: String as PropType<string | null>, default: undefined },
    defaultValue: { type: String as PropType<string | null>, default: undefined },
    /** `automatic` (default): arrows select; `manual`: Enter or Space selects. */
    activationMode: { type: String as PropType<"automatic" | "manual">, default: "automatic" },
    orientation: { type: String as PropType<"horizontal" | "vertical">, default: "horizontal" },
    /** Arrow moves wrap at both ends (default true). */
    loop: { type: Boolean, default: true },
    /** How inactive panels are hidden (default `unmount`). */
    inactivePanels: { type: String as PropType<InactivePanels>, default: "unmount" },
    disabled: Boolean,
    /** Disabled tabs stay reachable by arrows (never selectable). */
    focusableWhenDisabled: Boolean,
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: string | null, _details: ChangeDetails<TabsEvent>) => true,
    "update:modelValue": (_value: string | null) => true,
  },
  slots: Object as SlotsType<{ default?: (state: TabsState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    const instance = useRootId(() => props.id)
    const ids = computed(() => {
      const t = tabsIds(instance())
      return { list: t.list, item: t.tab }
    })
    const { collection: registered, registry } = useCollectionItems()
    const collection = () => registered.value ?? EMPTY
    const onValueChange = changeEmitter<string | null, TabsEvent>(
      (v, d) => emit("valueChange", v, d),
      (v) => emit("update:modelValue", v),
    )
    const { view, send } = useMachine(
      tabsMachine,
      () => ({
        collection: collection(),
        strategy: "roving" as const,
        ids: ids.value,
        loop: props.loop,
        focusableWhenDisabled: props.focusableWhenDisabled,
        value: props.modelValue,
        defaultValue: props.defaultValue,
        onValueChange,
        activationMode: props.activationMode,
        disabled: props.disabled,
      }),
      env,
    )
    const current = () => view.value.values.value ?? null
    const panels = shallowRef<ReadonlySet<string>>(new Set())
    const registerPanel = (key: string) => {
      if (!panels.value.has(key)) panels.value = new Set(panels.value).add(key)
      return () => {
        if (!panels.value.has(key)) return
        const next = new Set(panels.value)
        next.delete(key)
        panels.value = next
      }
    }
    // The declared tabs and panels of the latest render, until the tabs register (server render).
    let declared = { stop: null as string | null, panels: [] as readonly string[] }
    const api = () =>
      tabsConnect(
        {
          instance: instance(),
          collection: collection(),
          value: current(),
          highlightedKey: view.value.context.highlightedKey,
          pending: registered.value === null,
          pendingStop: declared.stop,
          orientation: props.orientation,
          activationMode: props.activationMode,
          inactivePanels: props.inactivePanels,
          disabled: props.disabled,
          focusableWhenDisabled: props.focusableWhenDisabled,
          focusWithin: view.value.matches("focused"),
          renderedPanels:
            registered.value === null
              ? new Set(
                  declared.panels.filter(
                    (k) => props.inactivePanels !== "unmount" || k === current(),
                  ),
                )
              : panels.value,
          panelTabbable: view.value.context.panelTabbable,
          direction: view.value.context.direction,
          indicator: view.value.context.indicator,
          revealed: view.value.context.revealed,
        },
        send,
        env,
      )
    provide(TabsKey, {
      api,
      send,
      registry,
      instance,
      value: current,
      disabled: () => props.disabled,
      inactivePanels: () => props.inactivePanels,
      orientation: () => props.orientation,
      collection: () => registered.value,
      registerPanel,
    })
    return () => {
      const children = slots.default?.({ value: current(), orientation: props.orientation })
      if (registered.value === null) {
        const now = current()
        declared = {
          stop: serverStop(declaredItems(children, Tab), now === null ? [] : [now]),
          panels: declaredItems(children, Panel).map((p) => p.value),
        }
      }
      return renderPart(
        "div",
        mergeProps(normalizeProps(api().root()), attrs),
        children,
        props.asChild,
      )
    }
  },
})

const List = defineComponent({
  name: "TabsList",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{ default?: (state: TabsState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = useTabs("List")
    const el = shallowRef<Element | null>(null)
    // Development: a tablist needs a name (aria-label or aria-labelledby).
    const check = () => {
      const node = el.value
      if (process.env.NODE_ENV === "production" || !node) return
      if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
        console.warn(
          `[rind-ui] tabs: the list #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    }
    onMounted(check)
    onUpdated(check)
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(ctx.api().list()), ref: refTo(el) }, attrs),
        slots.default?.({ value: ctx.value(), orientation: ctx.orientation() }),
        props.asChild,
      )
  },
})

export interface TabsTabState {
  readonly selected: boolean
  readonly disabled: boolean
}

const Tab = defineComponent({
  name: "TabsTab",
  inheritAttrs: false,
  props: {
    /** The key pairing this tab with its panel. */
    value: { type: String, required: true },
    /** Disables this tab: it is never selected. */
    disabled: Boolean,
    /** The text for the collection (defaults to the tab's text content). */
    textValue: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: TabsTabState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = useTabs("Tab")
    const env = useEnvironment()
    // The modality tracker must see the pointerdown that comes before focus.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const key = (): CollectionKey => toKey(props.value)
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    useRegisterItem(
      ctx.registry,
      () => ({ key: props.value, textValue: props.textValue, disabled: props.disabled }),
      el,
    )
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
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
    return () => {
      const children = slots.default?.({ selected: ctx.value() === key(), disabled: isDisabled() })
      const own = normalizeProps(
        ctx.api().tab(key(), {
          tag: renderedTag("button", children, props.asChild, measured.value),
          itemDisabled: props.disabled,
          focused: focused.value,
          modality: modality.value,
          pressed: press.pressed.value,
          hovered: hover.hovered.value,
        }),
      )
      const merged = mergeProps(
        {
          ...joinHandlers(own, press.props, hover.props, {
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

const Panel = defineComponent({
  name: "TabsPanel",
  inheritAttrs: false,
  props: {
    /** The key of the tab this panel belongs to. */
    value: { type: String, required: true },
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: { readonly selected: boolean }) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = useTabs("Panel")
    const env = useEnvironment()
    const key = (): CollectionKey => toKey(props.value)
    const selected = () => ctx.value() === key()
    const rendered = () => ctx.api().panelRendered(key())
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      // Registered while rendered (aria-controls on the tab).
      watch(
        [rendered, () => props.value],
        ([r, value], _old, onCleanup) => {
          if (r) onCleanup(ctx.registerPanel(value))
        },
        { immediate: true },
      )
      // A visible panel without tabbable content is itself a tab stop (re-evaluated live).
      watch(
        [selected, el, key],
        ([s, node, k], _old, onCleanup) => {
          if (!node || !s) return
          onCleanup(
            observeTabbable(node, (tabbable) =>
              ctx.send({ type: "PANEL.TABBABLE", key: k, tabbable }),
            ),
          )
        },
        { immediate: true, flush: "post" },
      )
      // until-found: imperative, re-applied after every update; beforematch selects the tab.
      watch(
        [() => ctx.inactivePanels() === "until-found", el, key],
        ([findable, node, k], _old, onCleanup) => {
          if (!findable || !(node instanceof HTMLElement)) return
          const h = untilFound(node, {
            scheduler: env.scheduler,
            isOpen: selected,
            onReveal: () => ctx.send({ type: "find-in-page", key: k }),
          })
          finder = h
          onCleanup(() => {
            h.dispose()
            finder = null
          })
        },
        { immediate: true, flush: "post" },
      )
      finder?.sync()
    })
    let finder: ReturnType<typeof untilFound> | null = null
    onUpdated(() => finder?.sync())
    return () => {
      if (!rendered()) return null
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(ctx.api().panel(key())), ref: refTo(el) }, attrs),
        slots.default?.({ selected: selected() }),
        props.asChild,
      )
    }
  },
})

const Indicator = defineComponent({
  name: "TabsIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{ default?: (state: { readonly visible: boolean }) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = useTabs("Indicator")
    const el = shallowRef<Element | null>(null)
    useSelectionIndicator({
      el,
      selectedId: () => {
        const value = ctx.value()
        return value === null ? null : tabsIds(ctx.instance()).tab(toKey(value))
      },
      itemSelector: `[data-part="tab"][data-instance="${ctx.instance()}"]`,
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

/** The parts, by name: `tabs.parts.ts` re-exports them as the `Tabs` namespace. */
export { Indicator, List, Panel, Root, Tab }
