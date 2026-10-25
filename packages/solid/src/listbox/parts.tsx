/** @jsxImportSource solid-js */
// The listbox parts as Solid components, bound to a host's context (design §2): Listbox's own
// Root, and Select's and Combobox's popups. Wiring only: every attribute is the core parts'.
import {
  type Collection,
  type CollectionKey,
  type ItemRegistry,
  type ListboxParts,
  type SectionNode,
  toKey,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, renderPart } from "../render"
import { useRegisterItem } from "../use-collection-items"

declare const process: { env: { NODE_ENV?: string } }

/** What a host gives its listbox parts (accessors: read in a computation, they stay reactive). */
export interface ListboxHost {
  /** The component name in errors and warnings ("Listbox", "Select"). */
  readonly name: string
  readonly parts: Accessor<ListboxParts>
  readonly collection: Accessor<Collection<unknown>>
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

type Own<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread. */
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

const SectionCtx = createContext<{ key: string; label: string } | undefined>(undefined)
const ItemCtx = createContext<Accessor<CollectionKey> | null>(null)

const INTERACTIVE =
  "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true']"

export type ListboxSpanProps = Own<JSX.HTMLAttributes<HTMLSpanElement>>
export type ListboxDivProps = Own<JSX.HTMLAttributes<HTMLDivElement>>
export type ListboxItemProps = ListboxDivProps & {
  /** The item key. */
  readonly value: string
  /** Used by typeahead, filtering, announcements and form labels (default: the text content). */
  readonly textValue?: string | undefined
  /** Disables this option: it cannot be selected. */
  readonly disabled?: boolean | undefined
  /** Extra filter terms (synonyms); never typeahead, announcements or labels. */
  readonly keywords?: readonly string[] | undefined
}
export type ListboxItemIndicatorProps = ListboxSpanProps & {
  /** Rendered while not selected too (hidden by CSS on `data-state`). */
  readonly keepMounted?: boolean | undefined
}
export type ListboxSectionProps = Omit<ListboxDivProps, "children"> & {
  /** The section's key and label; the label names it and is the default heading. */
  readonly section: { readonly key: string; readonly label: string }
  /** The section label part (default: the label text). */
  readonly label?: JSX.Element
  /** The section's items. */
  readonly children?: JSX.Element
}
export interface ListboxItemsProps {
  /** Each item's content from its label and key (default: an ItemText with the label). */
  readonly children?: (label: string, key: string) => JSX.Element
}

/* @__NO_SIDE_EFFECTS__ */
export function createListboxParts(useHost: (part: string) => ListboxHost) {
  function Label(props: ListboxSpanProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const host = useHost("Label")
    createEffect(() => {
      host.mount("label", true)
      onCleanup(() => host.mount("label", false))
    })
    const merged = createMemo(() => mergeProps(normalizeProps(host.parts().label()), rest))
    const children = () => local.children
    return renderPart(local.render, merged, undefined, children, (p) => (
      <span {...p}>{children()}</span>
    ))
  }

  function List(props: ListboxDivProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const host = useHost("List")
    const [el, setEl] = createSignal<HTMLElement | null>(null)
    // Development: a list needs a name (mui/base-ui#5569). Checked after the re-render a
    // Label's mount causes, not on the first commit.
    afterMount(() => {
      const node = el()
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
    const merged = createMemo(() =>
      mergeProps(
        {
          ...normalizeProps(
            host.parts().list({
              "aria-label": rest["aria-label"],
              "aria-labelledby": rest["aria-labelledby"],
            }),
          ),
          ref: setEl,
        },
        rest,
      ),
    )
    const children = () => local.children
    return renderPart(local.render, merged, undefined, children, (p) => (
      <div {...p}>{children()}</div>
    ))
  }

  function Item(props: ListboxItemProps) {
    const [local, rest] = splitProps(props, [
      "value",
      "textValue",
      "disabled",
      "keywords",
      "render",
      "children",
    ])
    const host = useHost("Item")
    const key = createMemo(() => toKey(local.value))
    const section = useContext(SectionCtx)
    const [el, setEl] = createSignal<HTMLElement | null>(null)
    useRegisterItem(
      host.registry,
      () => ({
        key: local.value,
        textValue: local.textValue,
        disabled: local.disabled,
        keywords: local.keywords,
        section,
      }),
      el,
    )
    // Development: no interactive element inside an option.
    afterMount(() => {
      const node = el()
      if (process.env.NODE_ENV === "production" || !node) return
      const nested = node.querySelector(INTERACTIVE)
      if (nested) {
        console.warn(
          `[rind-ui] ${host.name}: the item "${local.value}" contains an interactive <${nested.tagName.toLowerCase()}>; options cannot hold controls.`,
        )
      }
    })
    const own = createMemo(() => host.parts().item(key()))
    // Virtualized: the highlighted item mounts after the scroll. Focus left on the list, or
    // dropped to the body when the previous item unmounted, moves to it while the list is
    // the focused composite.
    const highlighted = createMemo(() => own()["data-highlighted"] !== undefined)
    afterMount(() => {
      createEffect(
        on(highlighted, (isHighlighted) => {
          const node = el()
          const doc = node?.ownerDocument
          const active = doc?.activeElement
          const listFocused = host.parts().list()["data-focus"] !== undefined
          const onList = active?.getAttribute("role") === "listbox" && active.contains(node ?? null)
          const dropped = active === doc?.body || active === null
          if (isHighlighted && listFocused && node && (onList || dropped))
            node.focus({ preventScroll: true })
        }),
      )
    })
    const listed = () => !host.listed || host.listed(key())
    const merged = createMemo(() => mergeProps({ ...normalizeProps(own()), ref: setEl }, rest))
    const children = () => local.children
    return (
      <ItemCtx.Provider value={key}>
        <Show
          when={listed()}
          fallback={
            <div ref={setEl} hidden data-scope={own()["data-scope"]} data-part="item">
              {children()}
            </div>
          }
        >
          {renderPart(local.render, merged, undefined, children, (p) => (
            <div {...p}>{children()}</div>
          ))}
        </Show>
      </ItemCtx.Provider>
    )
  }

  const useItemKey = (part: string) => {
    const key = useContext(ItemCtx)
    if (key === null) throw new Error(`${part} must be inside an Item`)
    return key
  }

  function ItemText(props: ListboxSpanProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const host = useHost("ItemText")
    const merged = createMemo(() => mergeProps(normalizeProps(host.parts().itemText()), rest))
    const children = () => local.children
    return renderPart(local.render, merged, undefined, children, (p) => (
      <span {...p}>{children()}</span>
    ))
  }

  function ItemDescription(props: ListboxSpanProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const host = useHost("ItemDescription")
    const key = useItemKey("ItemDescription")
    createEffect(() => {
      const k = key()
      host.mountDescription(k, true)
      onCleanup(() => host.mountDescription(k, false))
    })
    const merged = createMemo(() =>
      mergeProps(normalizeProps(host.parts().itemDescription(key())), rest),
    )
    const children = () => local.children
    return renderPart(local.render, merged, undefined, children, (p) => (
      <span {...p}>{children()}</span>
    ))
  }

  function ItemIndicator(props: ListboxItemIndicatorProps) {
    const [local, rest] = splitProps(props, ["keepMounted", "render", "children"])
    const host = useHost("ItemIndicator")
    const key = useItemKey("ItemIndicator")
    const own = createMemo(() => host.parts().itemIndicator(key()))
    const merged = createMemo(() => mergeProps(normalizeProps(own()), rest))
    const children = () => local.children
    return (
      <Show when={local.keepMounted === true || own()["data-state"] === "selected"}>
        {renderPart(local.render, merged, undefined, children, (p) => (
          <span {...p}>{children()}</span>
        ))}
      </Show>
    )
  }

  function Section(props: ListboxSectionProps) {
    const [local, rest] = splitProps(props, ["section", "label", "children", "render"])
    const host = useHost("Section")
    const node = createMemo<SectionNode>(() => ({
      type: "section",
      key: toKey(local.section.key),
      label: local.section.label,
    }))
    const merged = createMemo(() => mergeProps(normalizeProps(host.parts().section(node())), rest))
    const ctx = () => ({ key: local.section.key, label: local.section.label })
    // A section the host does not list (all its items filtered out) is hidden, still mounted.
    const listed = () =>
      !host.listed ||
      host
        .collection()
        .sections()
        .some((x) => x.key === node().key)
    const children = () => (
      <>
        <span {...normalizeProps(host.parts().sectionLabel(node()))}>
          {local.label ?? local.section.label}
        </span>
        <SectionCtx.Provider value={ctx()}>{local.children}</SectionCtx.Provider>
      </>
    )
    return (
      <Show
        when={listed()}
        fallback={
          <div hidden>
            <SectionCtx.Provider value={ctx()}>{local.children}</SectionCtx.Provider>
          </div>
        }
      >
        {renderPart(local.render, merged, undefined, children, (p) => (
          <div {...p}>{children()}</div>
        ))}
      </Show>
    )
  }

  function Separator(props: ListboxDivProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const host = useHost("Separator")
    // A decorative separator takes no name.
    const merged = createMemo(() =>
      mergeProps(
        normalizeProps(host.parts().separator()),
        Object.fromEntries(
          Object.entries(rest).filter(([k]) => k !== "aria-label" && k !== "aria-labelledby"),
        ),
      ),
    )
    const children = () => local.children
    return renderPart(local.render, merged, undefined, children, (p) => (
      <div {...p}>{children()}</div>
    ))
  }

  function Empty(props: ListboxDivProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const host = useHost("Empty")
    const [el, setEl] = createSignal<HTMLElement | null>(null)
    const shown = createMemo(() => host.parts().isEmpty)
    createEffect(() => {
      if (!shown()) return
      host.mount("empty", true)
      onCleanup(() => host.mount("empty", false))
    })
    // Development: the empty part is a sibling of the list, never inside it.
    afterMount(() => {
      if (process.env.NODE_ENV === "production") return
      if (el()?.closest('[role="listbox"]')) {
        console.warn(`[rind-ui] ${host.name}: Empty is inside the list; render it after List.`)
      }
    })
    const merged = createMemo(() =>
      mergeProps({ ...normalizeProps(host.parts().empty()), ref: setEl }, rest),
    )
    const children = () => local.children
    return (
      <Show when={shown()}>
        {renderPart(local.render, merged, undefined, children, (p) => (
          <div {...p}>{children()}</div>
        ))}
      </Show>
    )
  }

  function LoadMore(props: ListboxDivProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const host = useHost("LoadMore")
    const [el, setEl] = createSignal<HTMLElement | null>(null)
    afterMount(() => {
      const node = el()
      if (!node || typeof IntersectionObserver === "undefined") return
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) host.requestLoadMore()
      })
      observer.observe(node)
      onCleanup(() => observer.disconnect())
    })
    const merged = createMemo(() =>
      mergeProps({ ...normalizeProps(host.parts().loadMore()), ref: setEl }, rest),
    )
    const children = () => local.children
    return renderPart(local.render, merged, undefined, children, (p) => (
      <div {...p}>{children()}</div>
    ))
  }

  /** Data mode: every section and item of the collection, in render order. */
  function Items(props: ListboxItemsProps) {
    const host = useHost("Items")
    const groups = createMemo(() => {
      const c = host.collection()
      const out: { section: SectionNode | null; keys: CollectionKey[] }[] = []
      for (const node of c) {
        if (node.type === "section") out.push({ section: node, keys: [] })
        else {
          const last = out.at(-1)
          const owner = node.parentKey
          if (last && (last.section?.key ?? null) === owner) last.keys.push(node.key)
          else out.push({ section: null, keys: [node.key] })
        }
      }
      return out
    })
    const item = (key: CollectionKey) => {
      const node = host.collection().get(key)
      return node ? (
        <Item value={key} textValue={node.textValue} disabled={node.disabled}>
          {props.children ? (
            props.children(node.textValue, key)
          ) : (
            <ItemText>{node.textValue}</ItemText>
          )}
        </Item>
      ) : null
    }
    return (
      <For each={groups()}>
        {(g) =>
          g.section ? (
            <Section section={g.section}>
              <For each={g.keys}>{item}</For>
            </Section>
          ) : (
            <For each={g.keys}>{item}</For>
          )
        }
      </For>
    )
  }

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
