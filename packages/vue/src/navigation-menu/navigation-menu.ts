import {
  contentSize,
  domHoverIntent,
  domPositioning,
  type HoverIntent,
  type MessageOverrides,
  type NavigationMenuLevel,
  type NavigationMenuMessages,
  type NavigationMenuProps,
  navigationMenuConnect,
  navigationMenuIds,
  navigationMenuLayerId,
  navigationMenuLevel,
  navigationMenuMachine,
  navigationMenuMessages,
  navigationMenuPositioning,
  type PositioningProps,
  type Service,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  type ComputedRef,
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
  type ShallowRef,
  type SlotsType,
  shallowRef,
  Teleport,
  useId,
  type VNodeChild,
  watch,
} from "vue"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { keepStyle } from "../keep-style"
import { provideLayer, useParentLayer } from "../layer-context"
import { Link } from "../link/link"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { useHover, usePress } from "../use-press"
import { useSelectionIndicator } from "../use-selection-indicator"

declare module "../provider" {
  interface RindMessageScopes {
    "navigation-menu": NavigationMenuMessages
  }
}

type Api = ReturnType<typeof navigationMenuConnect>

interface Positioned {
  readonly anchor: "trigger" | "list"
  readonly positioning?: PositioningProps | undefined
  /** One Positioner per item (around its Content), not one around the Viewport. */
  readonly perItem: boolean
}

interface Delays {
  readonly openDelay?: number | undefined
  readonly closeDelay?: number | undefined
  readonly skipDelay?: number | undefined
  readonly patientClick?: number | undefined
}

interface LevelCtx {
  readonly service: Service<typeof navigationMenuMachine>
  readonly root: () => string
  readonly api: ComputedRef<Api>
  readonly value: () => string | null
  readonly level: NavigationMenuLevel
  readonly orientation: () => "horizontal" | "vertical"
  readonly closedContent: () => "hidden" | "unmount"
  readonly disabled: () => boolean
  readonly hoverIntent: HoverIntent
  readonly items: Map<string, HTMLElement>
  readonly itemsVersion: ShallowRef<number>
  readonly disabledItems: Map<string, boolean>
  readonly viewport: ShallowRef<HTMLElement | null>
  /** Registers a Positioner: `slot` is its item's key, or `""` around the Viewport. */
  readonly registerPositioner: (slot: string, p: Positioned) => () => void
  readonly current: ShallowRef<ReadonlySet<string>>
  readonly markCurrent: (key: string, on: boolean) => void
  /** The delays a Sub level inherits. */
  readonly delays: () => Delays
}

/** A panel, and the panel it is nested in (a current link marks every ancestor trigger). */
interface PanelCtx {
  readonly item: string
  readonly level: LevelCtx
  readonly parent: PanelCtx | null
}

interface ItemCtx {
  /** The level the item belongs to (a Sub's Positioner is not its parent item's). */
  readonly root: string
  readonly key: string
  readonly contentMounted: ShallowRef<boolean>
}

const LevelKey: InjectionKey<LevelCtx> = Symbol("rind-ui.navigation-menu")
const ItemKey: InjectionKey<ItemCtx> = Symbol("rind-ui.navigation-menu-item")
/** Inside a panel: links and nested triggers move with ArrowDown / ArrowUp. */
const PanelKey: InjectionKey<PanelCtx> = Symbol("rind-ui.navigation-menu-panel")

function useLevel(part: string): LevelCtx {
  const ctx = inject(LevelKey, null)
  if (!ctx) throw new Error(`NavigationMenu.${part} must be inside NavigationMenu.Root`)
  return ctx
}
function useItem(part: string): ItemCtx {
  const ctx = inject(ItemKey, null)
  if (!ctx) throw new Error(`NavigationMenu.${part} must be inside NavigationMenu.Item`)
  return ctx
}

interface LevelInput {
  readonly value: string | null | undefined
  readonly defaultValue: string | null | undefined
  readonly onValueChange: NavigationMenuProps["onValueChange"]
  readonly orientation: "horizontal" | "vertical" | undefined
  readonly id: string | undefined
  readonly openOnHover?: boolean | undefined
  readonly disabled: boolean | undefined
  readonly openDelay?: number | undefined
  readonly closeDelay?: number | undefined
  readonly skipDelay?: number | undefined
  readonly patientClick?: number | undefined
  readonly closedContent: "hidden" | "unmount"
  readonly messages?: MessageOverrides<NavigationMenuMessages> | undefined
  readonly defaultOrientation: "horizontal" | "vertical"
}

/** One level's service and registries. Call in setup. */
function useLevelState(own: () => LevelInput, parent: LevelCtx | null): LevelCtx {
  const root = useRootId(() => own().id)
  const env = useEnvironment()
  const navEnv = { ...env, position: domPositioning(env), hoverIntent: domHoverIntent(env) }
  const locale = useLocale(() => undefined)
  const messages = useMessages("navigation-menu", navigationMenuMessages, () => own().messages)
  const items = new Map<string, HTMLElement>()
  const itemsVersion = shallowRef(0)
  const disabledItems = new Map<string, boolean>()
  const viewport = shallowRef<HTMLElement | null>(null)
  // Keyed per Positioner, so one item's Positioner unmounting leaves the others registered.
  const positioners = shallowRef<ReadonlyMap<string, Positioned>>(new Map())
  const registerPositioner = (slot: string, p: Positioned) => {
    positioners.value = new Map(positioners.value).set(slot, p)
    return () => {
      if (positioners.value.get(slot) !== p) return
      const next = new Map(positioners.value)
      next.delete(slot)
      positioners.value = next
    }
  }
  const current = shallowRef<ReadonlySet<string>>(new Set())
  const markCurrent = (key: string, on: boolean) => {
    if (current.value.has(key) === on) return
    const next = new Set(current.value)
    if (on) next.add(key)
    else next.delete(key)
    current.value = next
  }
  let service: Service<typeof navigationMenuMachine> | null = null
  const level = navigationMenuLevel(parent?.level ?? null, {
    close: () => service?.send({ type: "LINK.ACTIVATE" }),
    parentClose: () => service?.send({ type: "PARENT.CLOSE" }),
    openOnHover: () => own().openOnHover !== false,
  })
  if (parent) {
    onMounted(() => onBeforeUnmount(parent.level.add(level)))
  }
  const parentLayer = useParentLayer()
  const orientation = () => own().orientation ?? own().defaultOrientation
  // The open item's own Positioner, else the Viewport's, else any item's (a closed menu).
  // ponytail: read from the last value, so per-item `positioning` that differs between items
  // lags one switch; pass a per-key getter to the machine if that matters.
  let lastValue: string | null = null
  const positioner = (): Positioned | undefined =>
    positioners.value.get(lastValue ?? "") ??
    positioners.value.get("") ??
    positioners.value.values().next().value
  const machine = useMachine(
    navigationMenuMachine,
    () => {
      const o = own()
      const p = positioner()
      return {
        value: o.value,
        defaultValue: o.defaultValue,
        onValueChange: o.onValueChange,
        openOnHover: level.openOnHover(),
        disabled: o.disabled,
        openDelay: o.openDelay,
        closeDelay: o.closeDelay,
        skipDelay: o.skipDelay,
        patientClick: o.patientClick,
        orientation: orientation(),
        root: root(),
        parent: parentLayer(),
        level,
        isItemDisabled: (key: string) => disabledItems.get(key) === true,
        positioned:
          p === undefined ? undefined : p.perItem ? ("item" as const) : ("level" as const),
        anchor: p?.anchor,
        positioning: p?.positioning,
      }
    },
    navEnv,
  )
  service = machine.service
  const value = () => (machine.view.value.values.value as string | null | undefined) ?? null
  const api = computed(() => {
    const v = value()
    lastValue = v
    void itemsVersion.value
    // Item order for the motion direction: document order of the registered items.
    const order = [...items.entries()]
      .sort(([, a], [, b]) => (a.compareDocumentPosition(b) & 4 ? -1 : 1))
      .map(([k]) => k)
    const view = machine.view.value
    return navigationMenuConnect(
      {
        instance: root(),
        value: v,
        previous: view.context.previous,
        order,
        orientation: orientation(),
        dir: locale.value.dir,
        instant: view.context.instant,
        placement: view.context.placement,
        indicator: view.context.indicator,
        manual:
          navigationMenuPositioning({ positioning: positioner()?.positioning }).mode === "manual",
        messages: messages.value,
      },
      machine.service.send,
    )
  })
  return {
    service: machine.service,
    root,
    api,
    value,
    level,
    orientation,
    closedContent: () => own().closedContent,
    disabled: () => own().disabled === true,
    hoverIntent: navEnv.hoverIntent,
    items,
    itemsVersion,
    disabledItems,
    viewport,
    registerPositioner,
    current,
    markCurrent,
    delays: () => ({
      openDelay: own().openDelay,
      closeDelay: own().closeDelay,
      skipDelay: own().skipDelay,
      patientClick: own().patientClick,
    }),
  }
}

type Slots<S = undefined> = SlotsType<{
  default?: S extends undefined ? () => VNodeChild : (state: S) => VNodeChild
}>

const levelProps = {
  /** The open item's `value` (controlled, `v-model`); `null` when none is open. */
  modelValue: { type: String as PropType<string | null>, default: undefined },
  /** The item open at first (uncontrolled). */
  defaultValue: { type: String as PropType<string | null>, default: undefined },
  /** `horizontal` (default for the root) or `vertical` (default for a Sub). */
  orientation: String as PropType<"horizontal" | "vertical">,
  id: String,
  ...asChildProp,
} as const

const levelEmits = {
  /** The open item changed; `details.reason` says why. */
  valueChange: (
    _value: string | null,
    _details: Parameters<NonNullable<NavigationMenuProps["onValueChange"]>>[1],
  ) => true,
  "update:modelValue": (_value: string | null) => true,
}

/** The `navigation` landmark and its root level. */
const Root = defineComponent({
  name: "NavigationMenuRoot",
  inheritAttrs: false,
  props: {
    ...levelProps,
    /** Open items when a mouse or pen rests on their trigger (default true). */
    openOnHover: { type: Boolean, default: undefined },
    /** Disables every trigger. */
    disabled: { type: Boolean, default: undefined },
    /** Hover time before an item opens, in ms (default 200). */
    openDelay: Number,
    /** Time before a hover-opened panel closes after the pointer left, in ms (default 300). */
    closeDelay: Number,
    /** After a close, hovering a trigger within this time opens it at once, in ms (default 300). */
    skipDelay: Number,
    /** A press this soon after a hover open keeps the panel open, in ms (default 500). */
    patientClick: Number,
    /**
     * Closed panels: `hidden` (default) keeps them in the document with `hidden`, so their links
     * are crawlable and found by find-in-page indexing; `unmount` removes them after their exit
     * animation.
     */
    closedContent: { type: String as PropType<"hidden" | "unmount">, default: "hidden" },
    /** The landmark's default name (`label`, "Main"). */
    messages: Object as PropType<MessageOverrides<NavigationMenuMessages>>,
  },
  emits: levelEmits,
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const ctx = useLevelState(
      () => ({
        value: props.modelValue,
        defaultValue: props.defaultValue,
        onValueChange: (v, d) => {
          emit("valueChange", v as string | null, d)
          emit("update:modelValue", v as string | null)
        },
        orientation: props.orientation,
        id: props.id,
        openOnHover: props.openOnHover,
        disabled: props.disabled,
        openDelay: props.openDelay,
        closeDelay: props.closeDelay,
        skipDelay: props.skipDelay,
        patientClick: props.patientClick,
        closedContent: props.closedContent,
        messages: props.messages,
        defaultOrientation: "horizontal",
      }),
      null,
    )
    provide(LevelKey, ctx)
    return () => {
      const labelledBy = attrs["aria-labelledby"] as string | undefined
      return renderPart(
        "nav",
        mergeProps(normalizeProps(ctx.api.value.root({ labelledBy })), attrs),
        slots.default?.(),
        props.asChild,
      )
    }
  },
})

/** A nested level inside a Content: its own List, items and value; not a landmark. */
const Sub = defineComponent({
  name: "NavigationMenuSub",
  inheritAttrs: false,
  props: levelProps,
  emits: levelEmits,
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const parent = useLevel("Sub")
    const ctx = useLevelState(
      () => ({
        value: props.modelValue,
        defaultValue: props.defaultValue,
        onValueChange: (v, d) => {
          emit("valueChange", v as string | null, d)
          emit("update:modelValue", v as string | null)
        },
        orientation: props.orientation,
        id: props.id,
        disabled: parent.disabled(),
        ...parent.delays(),
        closedContent: parent.closedContent(),
        defaultOrientation: "vertical",
      }),
      parent,
    )
    provide(LevelKey, ctx)
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api.value.sub()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** The level's items. */
const List = defineComponent({
  name: "NavigationMenuList",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("List")
    return () =>
      renderPart(
        "ul",
        mergeProps(normalizeProps(ctx.api.value.list()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** One item: a Link, a Trigger with its Content, or both (a split item). */
const Item = defineComponent({
  name: "NavigationMenuItem",
  inheritAttrs: false,
  props: {
    /** The item's key in the level's `value` (default: a generated, SSR-stable key). */
    value: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Item")
    const generated = useId()
    const key = props.value ?? generated
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      if (!(el.value instanceof HTMLElement)) return
      ctx.items.set(key, el.value)
      ctx.itemsVersion.value++
    })
    onBeforeUnmount(() => {
      ctx.items.delete(key)
      ctx.itemsVersion.value++
    })
    provide(ItemKey, { root: ctx.root(), key, contentMounted: shallowRef(false) })
    return () =>
      renderPart(
        "li",
        mergeProps({ ...normalizeProps(ctx.api.value.item(key)), ref: refTo(el) }, attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

export interface NavigationMenuTriggerState {
  /** Its panel is open. */
  readonly open: boolean
}

/** The disclosure button that toggles the item's panel. */
const Trigger = defineComponent({
  name: "NavigationMenuTrigger",
  inheritAttrs: false,
  props: {
    /** Never opens by press, keyboard or hover. */
    disabled: Boolean,
    ...asChildProp,
  },
  slots: Object as Slots<NavigationMenuTriggerState>,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Trigger")
    const item = useItem("Trigger")
    const panel = inject(PanelKey, null)
    const env = useEnvironment()
    // rind's Fieldset and a native <fieldset disabled> disable it too (button-like-element).
    const fieldsetDisabled = useFieldsetDisabled()
    const fieldsetDom = shallowRef(false)
    const disabled = () =>
      props.disabled || ctx.disabled() || fieldsetDisabled.value || fieldsetDom.value
    onMounted(() =>
      watch(
        disabled,
        (d, _, onCleanup) => {
          ctx.disabledItems.set(item.key, d)
          if (d) ctx.service.send({ type: "DISABLED" })
          onCleanup(() => ctx.disabledItems.delete(item.key))
        },
        { immediate: true },
      ),
    )
    // The modality tracker needs a subscriber while the trigger is mounted.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const press = usePress({
      env,
      send: (e) => {
        if (e.type === "PRESS") ctx.api.value.press(item.key, e.modality)
      },
      disabled,
    })
    const hover = useHover({ env, disabled, send: () => {} })
    // Stable for the trigger's life: the handlers remember whether the pointer is on it.
    const intent = ctx.hoverIntent.triggerProps((e) =>
      ctx.service.send({ type: e.type, item: item.key }),
    )
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(() => {
      measure()
      const node = el.value
      if (!node) return
      const watch = watchFieldsetDisabled(node, (d) => (fieldsetDom.value = d))
      fieldsetDom.value = watch.disabled
      onBeforeUnmount(watch.stop)
    })
    onUpdated(measure)
    return () => {
      const children = slots.default?.({ open: ctx.value() === item.key })
      const tag = renderedTag("button", children, props.asChild, measured.value)
      const own = normalizeProps(
        ctx.api.value.trigger(item.key, {
          focused: focused.value,
          modality: modality.value,
          pressed: press.pressed.value,
          hovered: hover.hovered.value,
          tag,
          disabled: disabled(),
          current: ctx.current.value.has(item.key),
          contentMounted: item.contentMounted.value,
          inPanel: panel !== null,
        }),
      )
      const merged = mergeProps(
        {
          ...joinHandlers(
            own,
            press.props,
            hover.props,
            normalizeProps({
              onPointerMove: intent.onPointerMove,
              onPointerLeave: intent.onPointerLeave,
            }),
            {
              onFocus: () => (focused.value = true),
              onBlur: () => (focused.value = false),
            },
          ),
          ref: refTo(el),
        },
        attrs,
      )
      return renderPart("button", merged, children, props.asChild)
    }
  },
})

/** Content size properties, after the update that changed `open` (collapsible's sequence). */
function useSizeSequence(
  el: ShallowRef<Element | null>,
  value: () => string | null,
  part: "content" | "viewport",
  enabled: () => boolean,
) {
  let size: { node: HTMLElement; s: ReturnType<typeof contentSize> } | null = null
  let last: string | null | undefined
  let stop = () => {}
  const run = () => {
    const node = el.value
    const v = value()
    const prev = last
    if (prev === v) return
    last = v
    stop()
    stop = () => {}
    if (!(node instanceof HTMLElement) || !enabled()) return
    if (size?.node !== node) size = { node, s: contentSize(node, "rind-navigation-menu", part) }
    const s = size.s
    if (v === null) {
      if (prev !== undefined && prev !== null) s.closed()
      return
    }
    if (prev === undefined) return s.opened({ instant: true })
    if (prev === null) s.opened({ instant: false })
    else s.switched()
    // Settled once the enter animations finished (or at once when nothing animates).
    const running = node.getAnimations?.({ subtree: true }) ?? []
    let live = true
    void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(() => {
      if (live) s.settled()
    })
    stop = () => {
      live = false
    }
  }
  onMounted(run)
  onUpdated(run)
  onBeforeUnmount(() => stop())
}

export interface NavigationMenuContentState {
  /** The panel is open. */
  readonly open: boolean
}

/** The item's panel: in place, or inside the level's Viewport when one is rendered. */
const Content = defineComponent({
  name: "NavigationMenuContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<NavigationMenuContentState>,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Content")
    const item = useItem("Content")
    const open = () => ctx.value() === item.key
    const el = shallowRef<Element | null>(null)
    const presence = usePresence(open, el)
    const inViewport = () => ctx.viewport.value !== null
    // In a shared viewport the outgoing panel goes at once: the viewport animates the switch.
    const switchedAway = () => inViewport() && ctx.value() !== null && !open()
    const exiting = () => !open() && !switchedAway() && presence.state === "exiting"
    const mounted = () => ctx.closedContent() === "hidden" || open() || exiting()
    onMounted(() =>
      watch(
        mounted,
        (m, _, onCleanup) => {
          item.contentMounted.value = m
          if (m) onCleanup(() => (item.contentMounted.value = false))
        },
        { immediate: true },
      ),
    )
    useSizeSequence(
      el,
      () => (open() ? item.key : null),
      "content",
      () => !inViewport(),
    )
    // Layers opened from a panel (a nested level, a dialog) are this level's children.
    provideLayer(
      () => navigationMenuLayerId(ctx.root()),
      () => "popover",
    )
    provide(PanelKey, { item: item.key, level: ctx, parent: inject(PanelKey, null) })
    return () => {
      if (!mounted()) return null
      const isOpen = open()
      const leaving = exiting()
      const element = renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(ctx.api.value.content(item.key)),
            hidden: !isOpen && !leaving ? true : undefined,
            ...(leaving ? { inert: "" } : {}),
            ref: refTo(el),
          },
          attrs,
        ),
        slots.default?.({ open: isOpen }),
        props.asChild,
      )
      const viewport = ctx.viewport.value
      return viewport ? h(Teleport, { to: viewport }, [element]) : element
    }
  },
})

/** A link: `current` marks the page; a same-tab activation closes every open level. */
const NavLink = defineComponent({
  name: "NavigationMenuLink",
  inheritAttrs: false,
  props: {
    /** Sets `aria-current` and `data-current`; the link still navigates. */
    current: { type: [Boolean, String] as PropType<boolean | string>, default: undefined },
  },
  emits: {
    activate: (_details: { readonly disposition: string }) => true,
  },
  slots: Object as SlotsType<{ default?: (state: never) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const ctx = useLevel("Link")
    const panel = inject(PanelKey, null)
    const on = () => props.current !== undefined && props.current !== false
    // The current page marks the trigger of every panel the link is in, outermost included.
    const chain: { readonly item: string; readonly mark: LevelCtx["markCurrent"] }[] = []
    for (let p = panel; p; p = p.parent) chain.push({ item: p.item, mark: p.level.markCurrent })
    onMounted(() =>
      watch(
        on,
        (o, _, onCleanup) => {
          if (!o) return
          for (const c of chain) c.mark(c.item, true)
          onCleanup(() => {
            for (const c of chain) c.mark(c.item, false)
          })
        },
        { immediate: true },
      ),
    )
    // Arrow keys find the link by its id.
    const generated = useId()
    return () => {
      const own = normalizeProps(ctx.api.value.link({ inPanel: panel !== null }))
      return h(
        Link,
        {
          ...mergeProps({ ...own, id: `${ctx.root()}-link-${generated}` }, attrs),
          ...(props.current === undefined ? {} : { current: props.current }),
          onActivate: (details: { disposition: string }) => {
            emit("activate", details)
            if (details.disposition === "same-tab") ctx.level.closeTree()
          },
        } as never,
        slots,
      )
    }
  },
})

/** Decorative: the open trigger's box, inside List. */
const Indicator = defineComponent({
  name: "NavigationMenuIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Indicator")
    const el = shallowRef<Element | null>(null)
    useSelectionIndicator({
      el,
      selectedId: () => {
        const v = ctx.value()
        return v === null ? null : navigationMenuIds(ctx.root()).trigger(v)
      },
      itemSelector: '[data-scope="navigation-menu"][data-part="trigger"]',
      collection: () => ctx.itemsVersion.value,
      onMeasure: (box, cause) => ctx.service.send({ type: "INDICATOR.MEASURE", box, cause }),
    })
    return () =>
      renderPart(
        "li",
        mergeProps({ ...normalizeProps(ctx.api.value.indicator()), ref: refTo(el) }, attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** The shared panel the open content renders into, sized by the size properties. */
const Viewport = defineComponent({
  name: "NavigationMenuViewport",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Viewport")
    const el = shallowRef<Element | null>(null)
    const open = () => ctx.value() !== null
    const presence = usePresence(open, el, { subtree: () => true })
    onMounted(() => (ctx.viewport.value = el.value instanceof HTMLElement ? el.value : null))
    onBeforeUnmount(() => (ctx.viewport.value = null))
    useSizeSequence(el, ctx.value, "viewport", () => true)
    return () => {
      const exiting = !open() && presence.state === "exiting"
      return renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(ctx.api.value.viewport()),
            hidden: !open() && !exiting ? true : undefined,
            ref: refTo(el),
          },
          attrs,
        ),
        slots.default?.(),
        props.asChild,
      )
    }
  },
})

/**
 * Places the Viewport next to the open trigger; inside an Item (no Viewport), places that
 * item's Content next to its own trigger.
 */
const Positioner = defineComponent({
  name: "NavigationMenuPositioner",
  inheritAttrs: false,
  props: {
    /** What the panel is placed against: the open trigger (default) or the whole list. */
    anchor: { type: String as PropType<"trigger" | "list">, default: "trigger" },
    /** Side, alignment and offsets (default below, aligned to the start, 4 px away). */
    positioning: Object as PropType<PositioningProps>,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Positioner")
    const inItem = inject(ItemKey, null)
    // An item of this level (a Sub's Positioner sits in its parent's item, not its own).
    const item = inItem?.root === ctx.root() ? inItem.key : undefined
    const el = shallowRef<Element | null>(null)
    const open = () => (item === undefined ? ctx.value() !== null : ctx.value() === item)
    const presence = usePresence(open, el, { subtree: () => true })
    const perItem = item !== undefined
    // Positioning writes to this element's style too.
    const kept = keepStyle()
    onMounted(() =>
      watch(
        () => [props.anchor, JSON.stringify(props.positioning ?? null)] as const,
        (_, __, onCleanup) => {
          onCleanup(
            ctx.registerPositioner(item ?? "", {
              anchor: props.anchor,
              positioning: props.positioning,
              perItem,
            }),
          )
        },
        { immediate: true },
      ),
    )
    return () => {
      const exiting = !open() && presence.state === "exiting"
      const merged = mergeProps(
        {
          ...normalizeProps(ctx.api.value.positioner(item)),
          hidden: !open() && !exiting ? true : undefined,
          ref: refTo(el),
        },
        attrs,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.(), props.asChild))
    }
  },
})

/** The parts, by name: `navigation-menu.parts.ts` re-exports them as the `NavigationMenu` namespace. */
export { Content, Indicator, Item, List, NavLink as Link, Positioner, Root, Sub, Trigger, Viewport }
