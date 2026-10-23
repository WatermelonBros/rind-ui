import {
  type BreadcrumbsCurrentValue,
  type BreadcrumbsItemState,
  type BreadcrumbsMessages,
  type BreadcrumbsTrail,
  type BreadcrumbsTrailItem,
  breadcrumbsConnect,
  breadcrumbsItemState,
  breadcrumbsMessages,
  deriveTrail,
  type Href,
  type ItemRegistry,
  type MessageOverrides,
  type RouterOptions,
  warnBreadcrumbsInPopup,
  warnCurrentWithoutAria,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { Link, type LinkState } from "../link/link"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    breadcrumbs: BreadcrumbsMessages
  }
}

/** What an Item's Link reports up: where it goes and its text (the ellipsis menu's item). */
interface ItemMeta {
  readonly current?: boolean | undefined
  readonly href?: Href | undefined
  readonly routerOptions?: RouterOptions | undefined
  readonly text?: string | undefined
}

interface RootCtx {
  readonly instance: () => string
  readonly connect: () => ReturnType<typeof breadcrumbsConnect>
  readonly trail: () => BreadcrumbsTrail
  readonly items: () => readonly BreadcrumbsTrailItem[]
  readonly currentValue: () => BreadcrumbsCurrentValue
  readonly messages: () => BreadcrumbsMessages
  /** Null with the data-driven `items` prop: nothing registers. */
  readonly registry: () => ItemRegistry | null
  readonly setMeta: (key: string, meta: ItemMeta) => void
}
const RootKey: InjectionKey<RootCtx> = Symbol("rind-ui.breadcrumbs")
function useRoot(part: string): RootCtx {
  const ctx = inject(RootKey, null)
  if (!ctx) throw new Error(`Breadcrumbs.${part} must be inside Breadcrumbs.Root`)
  return ctx
}

interface ItemCtx {
  readonly key: () => string
  readonly state: () => BreadcrumbsItemState
  readonly linkMeta: { current: ItemMeta }
}
const ItemKey: InjectionKey<ItemCtx> = Symbol("rind-ui.breadcrumbs-item")
function useItem(part: string): ItemCtx {
  const ctx = inject(ItemKey, null)
  if (!ctx) throw new Error(`Breadcrumbs.${part} must be inside Breadcrumbs.Item`)
  return ctx
}

const sameMeta = (a: ItemMeta | undefined, b: ItemMeta) =>
  a !== undefined &&
  a.current === b.current &&
  a.href === b.href &&
  a.routerOptions === b.routerOptions &&
  a.text === b.text

export interface BreadcrumbsState {
  readonly collapsed: boolean
}

const Root = defineComponent({
  name: "BreadcrumbsRoot",
  inheritAttrs: false,
  props: {
    /** Collapse the middle items past this many. */
    maxItems: Number,
    /** Default 1. */
    itemsBeforeCollapse: Number,
    /** Default 1. */
    itemsAfterCollapse: Number,
    /** The current item's `aria-current`. Default `"page"`. */
    currentValue: { type: [Boolean, String] as PropType<BreadcrumbsCurrentValue>, default: "page" },
    /**
     * The trail as data: collapse is known while rendering (the server render collapses too).
     * Render one Item per entry, with the same `value`.
     */
    items: Array as PropType<readonly BreadcrumbsTrailItem[]>,
    messages: Object as PropType<MessageOverrides<BreadcrumbsMessages>>,
    id: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: BreadcrumbsState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const instance = useRootId(() => props.id)
    const messages = useMessages("breadcrumbs", breadcrumbsMessages, () => props.messages)
    const { collection, registry } = useCollectionItems()
    const meta = new Map<string, ItemMeta>()
    const version = shallowRef(0)
    const setMeta = (key: string, next: ItemMeta) => {
      if (sameMeta(meta.get(key), next)) return
      meta.set(key, next)
      version.value++
    }
    const items = computed((): readonly BreadcrumbsTrailItem[] => {
      if (props.items) return props.items
      void version.value
      const c = collection.value
      return Array.from({ length: c?.size ?? 0 }, (_, i) => {
        const it = c?.at(i)?.value
        const m = it ? meta.get(it.key) : undefined
        return {
          key: it?.key ?? "",
          current: m?.current,
          disabled: it?.disabled,
          href: m?.href,
          routerOptions: m?.routerOptions,
          textValue: m?.text ?? it?.textValue ?? "",
        }
      })
    })
    const trail = computed(() =>
      deriveTrail({
        items: items.value,
        maxItems: props.maxItems,
        itemsBeforeCollapse: props.itemsBeforeCollapse,
        itemsAfterCollapse: props.itemsAfterCollapse,
      }),
    )
    const connect = computed(() =>
      breadcrumbsConnect({
        instance: instance(),
        trail: trail.value,
        labelled: attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined,
        label: messages.value.label,
      }),
    )
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      if (el.value instanceof HTMLElement) warnBreadcrumbsInPopup(el.value)
    })
    provide(RootKey, {
      instance,
      connect: () => connect.value,
      trail: () => trail.value,
      items: () => items.value,
      currentValue: () => props.currentValue,
      messages: () => messages.value,
      registry: () => (props.items ? null : registry),
      setMeta,
    })
    return () =>
      renderPart(
        "nav",
        mergeProps(
          {
            ...normalizeProps(connect.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
            ref: refTo(el),
          },
          attrs,
        ),
        slots.default?.({ collapsed: trail.value.collapsed.length > 0 }),
        props.asChild,
      )
  },
})

const List = defineComponent({
  name: "BreadcrumbsList",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{ default?: (state: BreadcrumbsState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const root = useRoot("List")
    return () =>
      renderPart(
        "ol",
        mergeProps(normalizeProps(root.connect().list()), attrs),
        slots.default?.({ collapsed: root.trail().collapsed.length > 0 }),
        props.asChild,
      )
  },
})

const Item = defineComponent({
  name: "BreadcrumbsItem",
  inheritAttrs: false,
  props: {
    /** The Item's key: stable across renders, so the trail keeps its DOM nodes. */
    value: { type: String, required: true },
    /** `true` makes it current; `false` on the last Item opts out of the default. */
    current: { type: Boolean, default: undefined },
    disabled: Boolean,
    /** Its text in the ellipsis menu; default its Link's text. */
    textValue: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: BreadcrumbsItemState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const root = useRoot("Item")
    const el = shallowRef<Element | null>(null)
    // The registry is fixed by the Root's mode (data-driven or registered).
    useRegisterItem(
      root.registry(),
      () => ({ key: props.value, textValue: props.textValue, disabled: props.disabled }),
      el,
    )
    const state = () =>
      breadcrumbsItemState(root.trail(), props.value, props.disabled, root.currentValue())
    const linkMeta: { current: ItemMeta } = { current: {} }
    // After the Link's hooks (children run first): the Item's own `current` with its Link's.
    const report = () =>
      root.setMeta(props.value, {
        ...linkMeta.current,
        current: props.current,
        text: props.textValue ?? linkMeta.current.text,
      })
    onMounted(report)
    onUpdated(report)
    onMounted(() =>
      watch(
        () => state().current,
        (current) => {
          if (current && el.value instanceof HTMLElement) warnCurrentWithoutAria(el.value)
        },
        { immediate: true, flush: "post" },
      ),
    )
    provide(ItemKey, { key: () => props.value, state, linkMeta })
    return () => {
      const s = state()
      return renderPart(
        "li",
        mergeProps({ ...normalizeProps(root.connect().item(s)), ref: refTo(el) }, attrs),
        slots.default?.(s),
        props.asChild,
      )
    }
  },
})

/**
 * The crumb's link (link-navigation), or, for the current item without `href`, its text in a
 * `<span aria-current tabindex="-1">` (design §3): selectable, focusable, never a link.
 */
const CrumbLink = defineComponent({
  name: "BreadcrumbsLink",
  inheritAttrs: false,
  props: {
    href: [String, Object] as PropType<Href>,
    // Any value: RouterOptions is `never` until the app augments RouterConfig.
    routerOptions: null as unknown as PropType<RouterOptions>,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: LinkState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const root = useRoot("Link")
    const item = useItem("Link")
    const el = shallowRef<Element | null>(null)
    const asText = () => item.state().current && props.href === undefined
    const report = () => {
      item.linkMeta.current = {
        href: props.href,
        routerOptions: props.routerOptions,
        text: el.value?.textContent?.trim() ?? "",
      }
    }
    // A focused link that becomes the current text is a new element (an <a> becomes a <span>):
    // read the focus while the old element is still in the document, and give it back after
    // the update (react-spectrum#2592, #5294).
    let hadFocus = false
    let wasText = asText()
    onMounted(report)
    onUpdated(() => {
      report()
      const now = asText()
      if (wasText !== now && hadFocus && el.value instanceof HTMLElement) el.value.focus()
      wasText = now
    })
    return () => {
      hadFocus = el.value !== null && el.value === el.value.ownerDocument.activeElement
      const state = item.state()
      if (asText()) {
        const linkState: LinkState = {
          disabled: state.disabled,
          current: true,
          pressed: false,
          hovered: false,
          focusVisible: false,
        }
        return renderPart(
          "span",
          mergeProps(
            { ...normalizeProps(root.connect().currentText(state)), ref: refTo(el) },
            attrs,
          ),
          slots.default?.(linkState),
          props.asChild,
        )
      }
      return h(
        Link,
        {
          ...attrs,
          ref: refTo(el),
          ...(props.href === undefined ? {} : { href: props.href }),
          ...(props.routerOptions === undefined ? {} : { routerOptions: props.routerOptions }),
          disabled: state.disabled,
          ...(state.current ? { current: state.currentValue } : {}),
          "data-scope": "breadcrumbs",
          "data-part": "link",
          "data-instance": root.instance(),
          asChild: props.asChild,
        },
        slots,
      )
    }
  },
})

/** A glyph after the crumb, `aria-hidden`; no default content. */
const Separator = defineComponent({
  name: "BreadcrumbsSeparator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{ default?: (state: BreadcrumbsItemState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const root = useRoot("Separator")
    const item = useItem("Separator")
    return () => {
      const s = item.state()
      return renderPart(
        "span",
        mergeProps(normalizeProps(root.connect().separator(s)), attrs),
        slots.default?.(s),
        props.asChild,
      )
    }
  },
})

/** One collapsed item, for the ellipsis menu. */
export type BreadcrumbsCollapsedItem = Pick<
  BreadcrumbsTrailItem,
  "key" | "textValue" | "href" | "routerOptions" | "disabled"
>

export interface BreadcrumbsEllipsisState {
  readonly items: readonly BreadcrumbsCollapsedItem[]
  /** The trigger's accessible name: `messages.showCollapsed(count)`. */
  readonly label: string
  readonly count: number
}

/**
 * The collapsed items' place in the list, only while items are collapsed. Place it after the
 * first `itemsBeforeCollapse` Items; its slot usually renders a Menu (or Popover) whose
 * trigger is named `label`.
 */
const Ellipsis = defineComponent({
  name: "BreadcrumbsEllipsis",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{ default?: (state: BreadcrumbsEllipsisState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const root = useRoot("Ellipsis")
    return () => {
      const trail = root.trail()
      const count = trail.collapsed.length
      const label = root.messages().showCollapsed(count)
      const own = root.connect().ellipsis(label)
      if (!own) return null
      const items = root.items()
      const state: BreadcrumbsEllipsisState = {
        items: trail.collapsed.flatMap((key) => {
          const it = items.find((i) => i.key === key)
          return it
            ? [
                {
                  key: it.key,
                  textValue: it.textValue,
                  href: it.href,
                  routerOptions: it.routerOptions,
                  disabled: it.disabled,
                },
              ]
            : []
        }),
        label,
        count,
      }
      return renderPart(
        "li",
        mergeProps(normalizeProps(own), attrs),
        slots.default?.(state),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `breadcrumbs.parts.ts` re-exports them as the `Breadcrumbs` namespace. */
export { CrumbLink as Link, Ellipsis, Item, List, Root, Separator }
