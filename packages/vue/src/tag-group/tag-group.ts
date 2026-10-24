// Tag Group: the Root hosting the parts (design §4). Wiring only: the machine owns highlight,
// selection, activation and removal; connect owns every attribute. Tags come from `items`
// data or from static Tag parts (collections registration); both render the same DOM.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  checkTagGroupList,
  createListCollection,
  layoutCapability,
  type TagGroupActionDetails,
  type TagGroupMessages,
  type TagGroupParts,
  type TagGroupRemoveDetails,
  type TagGroupValue,
  tagGroupConnect,
  tagGroupIds,
  tagGroupMachine,
  tagSelectionOf,
  toKey,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

/** One tag of a data-driven group. */
export interface TagGroupItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  /** A link tag: its text renders as an anchor. */
  readonly href?: string
}
const fromData = (items: readonly TagGroupItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
  })
const EMPTY = fromData([])

export interface TagGroupChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}

interface Host {
  readonly parts: () => TagGroupParts
  readonly collection: () => Collection<unknown>
  readonly registry: () => ReturnType<typeof useCollectionItems>["registry"] | null
  readonly mount: (part: "label" | "description", on: boolean) => void
  readonly mountLink: (key: CollectionKey, on: boolean) => void
  readonly hover: (key: CollectionKey | null) => void
  readonly press: (key: CollectionKey | null) => void
  readonly hrefOf: (key: CollectionKey) => string | undefined
  readonly removable: () => boolean
}
const HostKey: InjectionKey<Host> = Symbol("rind-ui.tag-group")
const useHost = (part: string): Host => {
  const host = inject(HostKey, null)
  if (!host) throw new Error(`TagGroup.${part} must be inside TagGroup.Root`)
  return host
}
const TagKey: InjectionKey<{
  readonly key: () => CollectionKey
  readonly href: () => string | undefined
  readonly row: { value: Element | null }
}> = Symbol("rind-ui.tag-group-tag")
const ListKey: InjectionKey<boolean> = Symbol("rind-ui.tag-group-list")
type Slots = SlotsType<{ default?: () => VNodeChild }>

const Root = defineComponent({
  name: "TagGroupRoot",
  inheritAttrs: false,
  props: {
    /** `none` (default), `single` or `multiple`. */
    selectionMode: { type: String as PropType<"none" | "single" | "multiple">, default: "none" },
    /** Controlled selection (`v-model`): a key or null (single), keys (multiple). */
    modelValue: {
      type: [String, Array, null] as PropType<string | readonly string[] | null>,
      default: undefined,
    },
    defaultValue: {
      type: [String, Array, null] as PropType<string | readonly string[] | null>,
      default: undefined,
    },
    /** No user action leaves the selection empty. */
    disallowEmptySelection: { type: Boolean, default: undefined },
    disabled: Boolean,
    /** Disabled tags stay reachable (announced as dimmed). Default true. */
    focusableWhenDisabled: { type: Boolean, default: true },
    /** Arrow keys wrap around. Default true. */
    loop: { type: Boolean, default: true },
    /** How long typed characters build one typeahead search (ms). Default: 1000. */
    typeaheadTimeout: Number,
    /** Data tags. Without them (and without `collection`), Tag parts register themselves. */
    items: Array as PropType<readonly TagGroupItemData[]>,
    /** A collection built by the consumer, used instead of `items`. */
    collection: Object as PropType<Collection<unknown>>,
    /** Tags are removable: drop the keys from your data, or keep them (nothing happens). */
    onRemove: Function as PropType<
      (keys: readonly string[], details: TagGroupRemoveDetails) => void
    >,
    onAction: Function as PropType<(key: string, details: TagGroupActionDetails) => void>,
    messages: Object as PropType<Partial<TagGroupMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: string | readonly string[] | null, _details: TagGroupChangeDetails) =>
      true,
    "update:modelValue": (_value: string | readonly string[] | null) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    const instance = useRootId(() => props.id)
    const { collection: registered, registry } = useCollectionItems()
    const data = computed(() => (props.items ? fromData(props.items) : null))
    const collection = computed(() => props.collection ?? data.value ?? registered.value ?? EMPTY)
    const ids = computed(() => tagGroupIds(instance()))
    const staticLinks = shallowRef<ReadonlySet<CollectionKey>>(new Set())
    const links = computed(() => {
      const out = new Set<CollectionKey>(staticLinks.value)
      for (const i of props.items ?? []) if (i.href !== undefined) out.add(toKey(i.key))
      return out
    })
    const { view, send, service } = useMachine(
      tagGroupMachine,
      () => ({
        collection: collection.value,
        ids: ids.value,
        instance: instance(),
        strategy: "roving" as const,
        selectionMode: props.selectionMode,
        selectionBehavior: "toggle" as const,
        disallowEmptySelection: props.disallowEmptySelection,
        disabled: props.disabled,
        focusableWhenDisabled: props.focusableWhenDisabled,
        loop: props.loop,
        typeaheadTimeout: props.typeaheadTimeout,
        links: links.value,
        messages: props.messages,
        ...(props.modelValue === undefined ? {} : { value: props.modelValue as TagGroupValue }),
        defaultValue:
          (props.defaultValue as TagGroupValue | undefined) ??
          (props.selectionMode === "multiple" ? [] : null),
        onValueChange: (v: TagGroupValue, details: { event: unknown }) => {
          const e = details.event as { type: string; key?: string }
          emit("valueChange", v as never, { reason: e.type, key: e.key })
          emit("update:modelValue", v as never)
        },
        onRemove: props.onRemove
          ? (keys: readonly string[], d: TagGroupRemoveDetails) => props.onRemove?.(keys, d)
          : undefined,
        onAction: props.onAction
          ? (key: string, d: TagGroupActionDetails) => props.onAction?.(key, d)
          : undefined,
      }),
      env,
    )
    const mounted = shallowRef({ label: false, description: false })
    const hovered = shallowRef<CollectionKey | null>(null)
    const pressed = shallowRef<CollectionKey | null>(null)
    // The hint follows the last interaction anywhere (a virtual cursor arrives from outside).
    const modality = useModality(env.modality, () => true)
    const parts = computed(() =>
      tagGroupConnect(
        {
          instance: instance(),
          collection: collection.value,
          context: view.value.context,
          selection: tagSelectionOf(view.value.values.value as TagGroupValue),
          selectionMode: props.selectionMode,
          removable: props.onRemove !== undefined,
          actions: props.onAction !== undefined,
          links: links.value,
          disabled: props.disabled,
          focusableWhenDisabled: props.focusableWhenDisabled,
          pending: !props.collection && !data.value && registered.value === null,
          focused: view.value.matches("focused"),
          modality: modality.value,
          // platform-convention: touch screen readers reach the remove button; no Delete hint there
          touchDevice: env.platform.ios || env.platform.android,
          hoveredKey: hovered.value,
          pressedKey: pressed.value,
          typingAhead: () => {
            const t = service.getSnapshot().context.typeahead
            return t.buffer !== "" && env.clock.now() - t.at <= (props.typeaheadTimeout ?? 1000)
          },
          mounted: mounted.value,
          messages: props.messages,
          send,
        },
        env,
      ),
    )
    const hrefs = computed(
      () =>
        new Map(
          (props.items ?? []).flatMap((i) => (i.href ? [[toKey(i.key), i.href] as const] : [])),
        ),
    )
    provide(HostKey, {
      parts: () => parts.value,
      collection: () => collection.value,
      registry: () => (props.collection || data.value ? null : registry),
      mount: (part, on) => {
        if (mounted.value[part] !== on) mounted.value = { ...mounted.value, [part]: on }
      },
      mountLink: (key, on) => {
        if (staticLinks.value.has(key) === on) return
        const next = new Set(staticLinks.value)
        if (on) next.add(key)
        else next.delete(key)
        staticLinks.value = next
      },
      hover: (key) => (hovered.value = key),
      press: (key) => (pressed.value = key),
      hrefOf: (key) => hrefs.value.get(key),
      removable: () => props.onRemove !== undefined,
    })
    return () => {
      const p = parts.value
      return renderPart(
        "div",
        mergeProps(normalizeProps(p.root()), attrs),
        [slots.default?.(), p.hinted ? h("span", normalizeProps(p.hint()), p.hintText) : null],
        props.asChild,
      )
    }
  },
})

function mountedPart(name: "Label" | "Description", part: "label" | "description") {
  return defineComponent({
    name: `TagGroup${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const host = useHost(name)
      onMounted(() => host.mount(part, true))
      onBeforeUnmount(() => host.mount(part, false))
      return () =>
        renderPart(
          "span",
          mergeProps(normalizeProps(host.parts()[part]()), attrs),
          slots["default"]?.(),
          props.asChild,
        )
    },
  })
}
const Label = mountedPart("Label", "label")
const Description = mountedPart("Description", "description")

const List = defineComponent({
  name: "TagGroupList",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("List")
    const el = shallowRef<Element | null>(null)
    provide(ListKey, true)
    // After the update a Label's registration causes, not on the first mount.
    onMounted(() =>
      watch(
        () => host.parts().interactive,
        (interactive) => {
          const node = el.value
          queueMicrotask(() => {
            if (node instanceof HTMLElement && node.isConnected)
              checkTagGroupList(node, interactive)
          })
        },
        { immediate: true },
      ),
    )
    return () => {
      const naming = {
        "aria-label": attrs["aria-label"] as string | undefined,
        "aria-labelledby": attrs["aria-labelledby"] as string | undefined,
      }
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(host.parts().list(naming)), ref: refTo(el) }, attrs),
        slots.default?.(),
        props.asChild,
      )
    }
  },
})

const Tag = defineComponent({
  name: "TagGroupTag",
  inheritAttrs: false,
  props: {
    /** The tag key. */
    value: { type: String, required: true },
    /** The tag's text for typeahead and the remove button's name. */
    textValue: String,
    /** Disables this tag: it cannot be selected or removed. */
    disabled: { type: Boolean, default: undefined },
    /** A link tag: TagText renders an anchor to it. */
    href: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Tag")
    const key = () => toKey(props.value)
    const row = shallowRef<Element | null>(null)
    useRegisterItem(
      host.registry(),
      () => ({ key: props.value, textValue: props.textValue, disabled: props.disabled }),
      row,
    )
    onMounted(() =>
      watch(
        () => [key(), props.href !== undefined] as const,
        ([k, link], _old, onCleanup) => {
          if (!link) return
          host.mountLink(k, true)
          onCleanup(() => host.mountLink(k, false))
        },
        { immediate: true },
      ),
    )
    provide(TagKey, { key, href: () => props.href ?? host.hrefOf(key()), row })
    return () => {
      const naming = {
        "aria-label": attrs["aria-label"] as string | undefined,
        "aria-labelledby": attrs["aria-labelledby"] as string | undefined,
      }
      const k = key()
      return renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(host.parts().item(k, naming)),
            ref: refTo(row),
            // Hover for mouse and pen only.
            onPointerenter: (e: PointerEvent) => {
              if (e.pointerType !== "touch") host.hover(k)
            },
            onPointerleave: () => host.hover(null),
            onPointerdown: () => host.press(k),
            onPointerup: () => host.press(null),
            onPointercancel: () => host.press(null),
          },
          attrs,
        ),
        h("div", normalizeProps(host.parts().itemCell()), slots.default?.() as never),
        props.asChild,
      )
    }
  },
})

const TagText = defineComponent({
  name: "TagGroupTagText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("TagText")
    const tag = inject(TagKey, null)
    if (!tag) throw new Error("TagGroup.TagText must be inside TagGroup.Tag")
    return () => {
      const own = normalizeProps(host.parts().itemText(tag.key()))
      const href = tag.href()
      return href !== undefined
        ? renderPart("a", mergeProps({ ...own, href }, attrs), slots.default?.(), props.asChild)
        : renderPart("span", mergeProps(own, attrs), slots.default?.(), props.asChild)
    }
  },
})

/** The default remove icon: an SVG, so it adds no text to the tag's text value. */
const crossIcon = () =>
  h(
    "svg",
    {
      "aria-hidden": "true",
      focusable: "false",
      viewBox: "0 0 16 16",
      width: "1em",
      height: "1em",
    },
    [
      h("path", {
        d: "M4 4l8 8M12 4l-8 8",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
      }),
    ],
  )

const TagRemove = defineComponent({
  name: "TagGroupTagRemove",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("TagRemove")
    const tag = inject(TagKey, null)
    if (!tag && process.env.NODE_ENV !== "production")
      console.warn("[rind-ui] TagGroup: TagRemove is outside a Tag; it renders nothing.")
    return () => {
      if (!tag || !host.removable()) return null
      const own = host.parts().itemRemove(tag.key())
      return renderPart(
        "button",
        mergeProps(
          {
            ...normalizeProps(own),
            // The press focuses the tag (connect prevents the button's own focus).
            onPointerdown: (e: PointerEvent) => {
              ;(own["onPointerDown"] as ((e: unknown) => void) | undefined)?.(e)
              if (!e.defaultPrevented || (own["disabled"] as boolean | undefined)) return
              const row = tag.row.value
              if (row instanceof HTMLElement) row.focus({ preventScroll: true })
            },
          },
          attrs,
        ),
        slots.default?.() ?? crossIcon(),
        props.asChild,
      )
    }
  },
})

const Empty = defineComponent({
  name: "TagGroupEmpty",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Empty")
    const inList = inject(ListKey, false)
    onMounted(() => {
      if (process.env.NODE_ENV !== "production" && !inList)
        console.warn("[rind-ui] TagGroup: Empty is outside List; render it inside TagGroup.List.")
    })
    return () =>
      host.parts().isEmpty
        ? renderPart(
            "div",
            mergeProps(normalizeProps(host.parts().empty()), attrs),
            slots.default?.(),
            props.asChild,
          )
        : null
  },
})

/** Data mode: every tag of `items`, with its text and (removable) its remove button. */
const Tags = defineComponent({
  name: "TagGroupTags",
  /** Renders one tag's content from its label and key; default: TagText and TagRemove. */
  slots: Object as SlotsType<{ default?: (tag: { label: string; key: string }) => VNodeChild }>,
  setup(_props, { slots }) {
    const host = useHost("Tags")
    return () => {
      const out = []
      for (const node of host.collection()) {
        if (node.type !== "item") continue
        out.push(
          h(
            Tag,
            { key: node.key, value: node.key, textValue: node.textValue, disabled: node.disabled },
            () =>
              slots.default
                ? slots.default({ label: node.textValue, key: node.key })
                : [h(TagText, null, () => node.textValue), h(TagRemove)],
          ),
        )
      }
      return out
    }
  },
})

/** A collection of tags: browse with one Tab stop; select, act on, follow or remove them. */
/** The parts, by name: `tag-group.parts.ts` re-exports them as the `TagGroup` namespace. */
export { Description, Empty, Label, List, Root, Tag, TagRemove, Tags, TagText }
