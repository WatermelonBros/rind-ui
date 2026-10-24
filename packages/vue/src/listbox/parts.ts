// The listbox parts as Vue components, bound to a host's injection key (design §2): Listbox's
// own Root, and Select's and Combobox's popups. Wiring only: every attribute is the core parts'.
import {
  type Collection,
  type CollectionKey,
  type ItemRegistry,
  type ListboxParts,
  type SectionNode,
  toKey,
} from "@rind-ui/core"
import {
  defineComponent,
  Fragment,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { asChildProp, renderPart } from "../render"
import { useRegisterItem } from "../use-collection-items"

declare const process: { env: { NODE_ENV?: string } }

/** What a host gives its listbox parts (getters: read in render, they stay reactive). */
export interface ListboxHost {
  /** The component name in errors and warnings ("Listbox", "Select"). */
  readonly name: string
  readonly parts: () => ListboxParts
  readonly collection: () => Collection<unknown>
  /** Static items register here (null: data or a given collection). */
  readonly registry: ItemRegistry | null
  readonly mount: (part: "label" | "empty", on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  /** The sentinel came into view (deduplicated per collection by the host). */
  readonly requestLoadMore: () => void
  /**
   * The host lists a subset of the registered items (Combobox filtering): the others stay
   * mounted, hidden and without a role, so they keep their registration and order.
   */
  readonly listed?: ((key: CollectionKey) => boolean) | undefined
}

const SectionKey: InjectionKey<{ key: string; label: string } | undefined> =
  Symbol("rind-ui.listbox-section")
const ItemKey: InjectionKey<() => CollectionKey> = Symbol("rind-ui.listbox-item")

const INTERACTIVE =
  "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true']"

/* @__NO_SIDE_EFFECTS__ */
export function createListboxParts(key: InjectionKey<ListboxHost>, prefix: string) {
  const useHost = (part: string): ListboxHost => {
    const host = inject(key, null)
    if (!host) throw new Error(`${prefix}.${part} must be inside ${prefix}.Root`)
    return host
  }
  const useItemKey = (part: string) => {
    const k = inject(ItemKey, null)
    if (k === null) throw new Error(`${part} must be inside an Item`)
    return k
  }

  const Label = defineComponent({
    name: `${prefix}Label`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const host = useHost("Label")
      onMounted(() => host.mount("label", true))
      onBeforeUnmount(() => host.mount("label", false))
      return () =>
        renderPart(
          "span",
          mergeProps(normalizeProps(host.parts().label()), attrs),
          slots["default"]?.(),
          props.asChild,
        )
    },
  })

  const List = defineComponent({
    name: `${prefix}List`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const host = useHost("List")
      const el = shallowRef<Element | null>(null)
      // Development: a list needs a name (mui/base-ui#5569). Checked after the update a Label's
      // mount causes, not on the first mount.
      onMounted(() => {
        const node = el.value
        if (process.env.NODE_ENV === "production" || !node) return
        queueMicrotask(() => {
          if (!node.isConnected) return
          if (!node.hasAttribute("aria-label") && !node.hasAttribute("aria-labelledby")) {
            console.warn(
              `[rind-ui] ${host.name}: the list has no accessible name; render a Label or pass aria-label / aria-labelledby.`,
            )
          }
        })
      })
      return () => {
        const naming = {
          "aria-label": attrs["aria-label"] as string | undefined,
          "aria-labelledby": attrs["aria-labelledby"] as string | undefined,
        }
        return renderPart(
          "div",
          mergeProps({ ...normalizeProps(host.parts().list(naming)), ref: refTo(el) }, attrs),
          slots["default"]?.(),
          props.asChild,
        )
      }
    },
  })

  const Item = defineComponent({
    name: `${prefix}Item`,
    inheritAttrs: false,
    props: {
      /** The item key. */
      value: { type: String, required: true },
      /** Used by typeahead, filtering, announcements and form labels (default: the text content). */
      textValue: String,
      /** Disables this option: it cannot be selected. */
      disabled: { type: Boolean, default: undefined },
      /** Extra filter terms (synonyms); never typeahead, announcements or labels. */
      keywords: Array as PropType<readonly string[]>,
      ...asChildProp,
    },
    setup(props, { attrs, slots }) {
      const host = useHost("Item")
      const k = () => toKey(props.value)
      const section = inject(SectionKey, undefined)
      const el = shallowRef<Element | null>(null)
      useRegisterItem(
        host.registry,
        () => ({
          key: props.value,
          textValue: props.textValue,
          disabled: props.disabled,
          keywords: props.keywords,
          section,
        }),
        el,
      )
      provide(ItemKey, k)
      onMounted(() => {
        // Development: no interactive element inside an option.
        const node = el.value
        if (process.env.NODE_ENV !== "production" && node) {
          const nested = node.querySelector(INTERACTIVE)
          if (nested) {
            console.warn(
              `[rind-ui] ${host.name}: the item "${props.value}" contains an interactive <${nested.tagName.toLowerCase()}>; options cannot hold controls.`,
            )
          }
        }
        // Virtualized: the highlighted item mounts after the scroll. Focus left on the list, or
        // dropped to the body when the previous item unmounted, moves to it while the list is
        // the focused composite.
        watch(
          () => host.parts().item(k())["data-highlighted"] !== undefined,
          (highlighted) => {
            const n = el.value
            const listFocused = host.parts().list()["data-focus"] !== undefined
            const doc = n?.ownerDocument
            const active = doc?.activeElement
            const onList = active?.getAttribute("role") === "listbox" && active.contains(n ?? null)
            const dropped = active === doc?.body || active === null
            if (highlighted && listFocused && n instanceof HTMLElement && (onList || dropped))
              n.focus({ preventScroll: true })
          },
          { immediate: true, flush: "post" },
        )
      })
      return () => {
        const own = host.parts().item(k())
        if (host.listed && !host.listed(k())) {
          return h(
            "div",
            { ref: refTo(el), hidden: true, "data-scope": own["data-scope"], "data-part": "item" },
            slots["default"]?.(),
          )
        }
        return renderPart(
          "div",
          mergeProps({ ...normalizeProps(own), ref: refTo(el) }, attrs),
          slots["default"]?.(),
          props.asChild,
        )
      }
    },
  })

  const ItemText = defineComponent({
    name: `${prefix}ItemText`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const host = useHost("ItemText")
      return () =>
        renderPart(
          "span",
          mergeProps(normalizeProps(host.parts().itemText()), attrs),
          slots["default"]?.(),
          props.asChild,
        )
    },
  })

  const ItemDescription = defineComponent({
    name: `${prefix}ItemDescription`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const host = useHost("ItemDescription")
      const k = useItemKey("ItemDescription")
      onMounted(() =>
        watch(
          k,
          (now, _old, onCleanup) => {
            host.mountDescription(now, true)
            onCleanup(() => host.mountDescription(now, false))
          },
          { immediate: true },
        ),
      )
      return () =>
        renderPart(
          "span",
          mergeProps(normalizeProps(host.parts().itemDescription(k())), attrs),
          slots["default"]?.(),
          props.asChild,
        )
    },
  })

  const ItemIndicator = defineComponent({
    name: `${prefix}ItemIndicator`,
    inheritAttrs: false,
    props: {
      /** Rendered while not selected too (hidden by CSS on `data-state`). */
      keepMounted: Boolean,
      ...asChildProp,
    },
    setup(props, { attrs, slots }) {
      const host = useHost("ItemIndicator")
      const k = useItemKey("ItemIndicator")
      return () => {
        const own = host.parts().itemIndicator(k())
        if (!props.keepMounted && own["data-state"] !== "selected") return null
        return renderPart(
          "span",
          mergeProps(normalizeProps(own), attrs),
          slots["default"]?.(),
          props.asChild,
        )
      }
    },
  })

  const Section = defineComponent({
    name: `${prefix}Section`,
    inheritAttrs: false,
    props: {
      /** The section's key and label; the label names it and is the default heading. */
      section: {
        type: Object as PropType<{ readonly key: string; readonly label: string }>,
        required: true,
      },
      ...asChildProp,
    },
    /** `label`: the section label part's content (default: the label text). */
    setup(props, { attrs, slots }) {
      const host = useHost("Section")
      provide(SectionKey, { key: props.section.key, label: props.section.label })
      return () => {
        const node: SectionNode = {
          type: "section",
          key: toKey(props.section.key),
          label: props.section.label,
        }
        // A section the host does not list (all its items filtered out) is hidden, still mounted.
        if (
          host.listed &&
          !host
            .collection()
            .sections()
            .some((x) => x.key === node.key)
        )
          return h("div", { hidden: true }, slots["default"]?.())
        return renderPart(
          "div",
          mergeProps(normalizeProps(host.parts().section(node)), attrs),
          [
            h(
              "span",
              normalizeProps(host.parts().sectionLabel(node)),
              slots["label"]?.() ?? props.section.label,
            ),
            slots["default"]?.(),
          ],
          props.asChild,
        )
      }
    },
  })

  const Separator = defineComponent({
    name: `${prefix}Separator`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs }) {
      const host = useHost("Separator")
      return () => {
        // A decorative separator takes no name.
        const { "aria-label": _l, "aria-labelledby": _b, ...own } = attrs
        return renderPart(
          "div",
          mergeProps(normalizeProps(host.parts().separator()), own),
          undefined,
          props.asChild,
        )
      }
    },
  })

  const Empty = defineComponent({
    name: `${prefix}Empty`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const host = useHost("Empty")
      const el = shallowRef<Element | null>(null)
      onMounted(() =>
        watch(
          () => host.parts().isEmpty,
          (shown, _old, onCleanup) => {
            if (!shown) return
            host.mount("empty", true)
            onCleanup(() => host.mount("empty", false))
          },
          { immediate: true },
        ),
      )
      // Development: the empty part is a sibling of the list, never inside it.
      const check = () => {
        if (process.env.NODE_ENV !== "production" && el.value?.closest('[role="listbox"]')) {
          console.warn(`[rind-ui] ${host.name}: Empty is inside the list; render it after List.`)
        }
      }
      onMounted(check)
      onUpdated(check)
      return () =>
        host.parts().isEmpty
          ? renderPart(
              "div",
              mergeProps({ ...normalizeProps(host.parts().empty()), ref: refTo(el) }, attrs),
              slots["default"]?.(),
              props.asChild,
            )
          : null
    },
  })

  const LoadMore = defineComponent({
    name: `${prefix}LoadMore`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const host = useHost("LoadMore")
      const el = shallowRef<Element | null>(null)
      onMounted(() => {
        const node = el.value
        if (!node || typeof IntersectionObserver === "undefined") return
        const observer = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) host.requestLoadMore()
        })
        observer.observe(node)
        onBeforeUnmount(() => observer.disconnect())
      })
      return () =>
        renderPart(
          "div",
          mergeProps({ ...normalizeProps(host.parts().loadMore()), ref: refTo(el) }, attrs),
          slots["default"]?.(),
          props.asChild,
        )
    },
  })

  /** Data mode: every section and item of the collection, in render order. */
  const Items = defineComponent({
    name: `${prefix}Items`,
    /** The default slot: each item's content from `{ label, key }` (default: an ItemText with the label). */
    setup(_props, { slots }) {
      const host = useHost("Items")
      return () => {
        const c = host.collection()
        const groups: { section: SectionNode | null; keys: CollectionKey[] }[] = []
        for (const node of c) {
          if (node.type === "section") groups.push({ section: node, keys: [] })
          else {
            const last = groups.at(-1)
            if (last && (last.section?.key ?? null) === node.parentKey) last.keys.push(node.key)
            else groups.push({ section: null, keys: [node.key] })
          }
        }
        const item = (k: CollectionKey): VNodeChild => {
          const node = c.get(k)
          return node
            ? h(
                Item,
                { key: k, value: k, textValue: node.textValue, disabled: node.disabled },
                () =>
                  slots["default"]
                    ? slots["default"]({ label: node.textValue, key: k })
                    : h(ItemText, null, () => node.textValue),
              )
            : null
        }
        return groups.map((g, i) =>
          g.section
            ? h(
                Section,
                { key: g.section.key, section: { key: g.section.key, label: g.section.label } },
                () => g.keys.map(item),
              )
            : h(Fragment, { key: `run-${i}` }, g.keys.map(item)),
        )
      }
    },
  })

  return {
    Label,
    List,
    Item,
    ItemText,
    ItemDescription,
    ItemIndicator,
    Section,
    Separator,
    Empty,
    LoadMore,
    Items,
  }
}
