// The listbox parts as React components, bound to a host's context (design §2): Listbox's
// own Root, and Select's popup later. Wiring only: every attribute is the core parts'.

import {
  type AnyMachine,
  type Collection,
  type CollectionKey,
  type ItemRegistry,
  type ListboxParts,
  type SectionNode,
  type Service,
  toKey,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, renderPart } from "../render"
import { useRegisterItem } from "../use-collection-items"
import { useSelector } from "../use-machine"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** What a host gives its listbox parts on every render. */
export interface ListboxHost {
  /** The component name in errors and warnings ("Listbox", "Select"). */
  readonly name: string
  readonly parts: ListboxParts
  readonly collection: Collection<unknown>
  /** Static items register here (null: data or a given collection). */
  readonly registry: ItemRegistry | null
  readonly mount: (part: "label" | "empty", on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  /** The sentinel came into view (deduplicated per collection by the host). */
  readonly requestLoadMore: () => void
  /** The host's service: parts re-render on their own slice of its view. */
  readonly service: Service<AnyMachine>
  /** What an item renders from (changes for two items when the highlight moves). */
  readonly itemSignature: (view: unknown, key: CollectionKey) => string
  /**
   * The host lists a subset of the registered items (Combobox filtering): the others stay
   * mounted, hidden and without a role, so they keep their registration and order.
   */
  readonly listed?: ((key: CollectionKey) => boolean) | undefined
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<undefined>
}

const SectionCtx = createContext<{ key: string; label: string } | undefined>(undefined)
const ItemCtx = createContext<CollectionKey | null>(null)

const INTERACTIVE =
  "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true']"

export function createListboxParts(useHost: (part: string) => ListboxHost) {
  function Label({ render, ...rest }: Own<"span">) {
    const host = useHost("Label")
    const { mount } = host
    useIsoLayoutEffect(() => {
      mount("label", true)
      return () => mount("label", false)
    }, [mount])
    return renderPart(
      "span",
      mergeProps(normalizeProps(host.parts.label()), rest),
      render,
      undefined,
    )
  }

  function List({ render, ...rest }: Own<"div">) {
    const host = useHost("List")
    useSelector(host.service, (v) => v)
    const el = useRef<HTMLDivElement | null>(null)
    // Development: a list needs a name (mui/base-ui#5569). Checked after the re-render a
    // Label's mount causes (its layout effect), not on the first commit.
    useEffect(() => {
      const node = el.current
      if (process.env.NODE_ENV === "production" || !node) return
      queueMicrotask(() => {
        if (!node.isConnected) return
        if (!node.hasAttribute("aria-label") && !node.hasAttribute("aria-labelledby")) {
          console.warn(
            `[rind-ui] ${host.name}: the list has no accessible name; render a Label or pass aria-label / aria-labelledby.`,
          )
        }
      })
    }, [host.name])
    const naming = {
      "aria-label": rest["aria-label"],
      "aria-labelledby": rest["aria-labelledby"],
    }
    const props = mergeProps({ ...normalizeProps(host.parts.list(naming)), ref: el }, rest)
    return renderPart("div", props, render, undefined)
  }

  function Item({
    value,
    textValue,
    disabled,
    keywords,
    render,
    children,
    ...rest
  }: Own<"div"> & {
    /** The item key. */
    readonly value: string
    readonly textValue?: string
    readonly disabled?: boolean
    readonly keywords?: readonly string[]
  }) {
    const host = useHost("Item")
    const key = toKey(value)
    const section = useContext(SectionCtx)
    const ref = useRef<HTMLDivElement | null>(null)
    useRegisterItem(host.registry, { key: value, textValue, disabled, keywords, section }, ref)
    useSelector(host.service, (v) => host.itemSignature(v, key))
    // Development: no interactive element inside an option.
    useEffect(() => {
      const node = ref.current
      if (process.env.NODE_ENV === "production" || !node) return
      const nested = node.querySelector(INTERACTIVE)
      if (nested) {
        console.warn(
          `[rind-ui] ${host.name}: the item "${value}" contains an interactive <${nested.tagName.toLowerCase()}>; options cannot hold controls.`,
        )
      }
    }, [host.name, value])
    const own = host.parts.item(key)
    // Virtualized: the highlighted item mounts after the scroll. Focus left on the list, or
    // dropped to the body when the previous item unmounted, moves to it while the list is
    // the focused composite.
    const highlighted = own["data-highlighted"] !== undefined
    const listFocused = host.parts.list()["data-focus"] !== undefined
    useIsoLayoutEffect(() => {
      const node = ref.current
      const doc = node?.ownerDocument
      const active = doc?.activeElement
      const onList = active?.getAttribute("role") === "listbox" && active.contains(node ?? null)
      const dropped = active === doc?.body || active === null
      if (highlighted && listFocused && node && (onList || dropped))
        node.focus({ preventScroll: true })
    }, [highlighted])
    if (host.listed && !host.listed(key)) {
      return (
        <ItemCtx value={key}>
          <div ref={ref} hidden data-scope={own["data-scope"]} data-part="item">
            {children}
          </div>
        </ItemCtx>
      )
    }
    const props = mergeProps({ ...normalizeProps(own), ref }, rest)
    return (
      <ItemCtx value={key}>{renderPart("div", { ...props, children }, render, undefined)}</ItemCtx>
    )
  }

  const useItemKey = (part: string) => {
    const key = useContext(ItemCtx)
    if (key === null) throw new Error(`${part} must be inside an Item`)
    return key
  }

  function ItemText({ render, ...rest }: Own<"span">) {
    const host = useHost("ItemText")
    return renderPart(
      "span",
      mergeProps(normalizeProps(host.parts.itemText()), rest),
      render,
      undefined,
    )
  }

  function ItemDescription({ render, ...rest }: Own<"span">) {
    const host = useHost("ItemDescription")
    const key = useItemKey("ItemDescription")
    const { mountDescription } = host
    useIsoLayoutEffect(() => {
      mountDescription(key, true)
      return () => mountDescription(key, false)
    }, [mountDescription, key])
    return renderPart(
      "span",
      mergeProps(normalizeProps(host.parts.itemDescription(key)), rest),
      render,
      undefined,
    )
  }

  function ItemIndicator({
    keepMounted = false,
    render,
    ...rest
  }: Own<"span"> & { readonly keepMounted?: boolean }) {
    const host = useHost("ItemIndicator")
    const key = useItemKey("ItemIndicator")
    const own = host.parts.itemIndicator(key)
    if (!keepMounted && own["data-state"] !== "selected") return null
    return renderPart("span", mergeProps(normalizeProps(own), rest), render, undefined)
  }

  function Section({
    section,
    label,
    children,
    render,
    ...rest
  }: Omit<Own<"div">, "children"> & {
    readonly section: { readonly key: string; readonly label: string }
    /** The section label part (default: the label text). */
    readonly label?: ReactNode
    readonly children?: ReactNode
  }) {
    const host = useHost("Section")
    const node: SectionNode = { type: "section", key: toKey(section.key), label: section.label }
    const props = mergeProps(normalizeProps(host.parts.section(node)), rest)
    // A section the host does not list (all its items filtered out) is hidden, still mounted.
    if (host.listed && !host.collection.sections().some((x) => x.key === node.key)) {
      return (
        <div hidden>
          <SectionCtx value={{ key: section.key, label: section.label }}>{children}</SectionCtx>
        </div>
      )
    }
    return renderPart(
      "div",
      {
        ...props,
        children: (
          <>
            <span {...normalizeProps(host.parts.sectionLabel(node))}>{label ?? section.label}</span>
            <SectionCtx value={{ key: section.key, label: section.label }}>{children}</SectionCtx>
          </>
        ),
      },
      render,
      undefined,
    )
  }

  function Separator({ render, ...rest }: Own<"div">) {
    const host = useHost("Separator")
    // A decorative separator takes no name.
    const { "aria-label": _l, "aria-labelledby": _b, ...own } = rest
    return renderPart(
      "div",
      mergeProps(normalizeProps(host.parts.separator()), own),
      render,
      undefined,
    )
  }

  function Empty({ render, ...rest }: Own<"div">) {
    const host = useHost("Empty")
    const { mount } = host
    const ref = useRef<HTMLDivElement | null>(null)
    const shown = host.parts.isEmpty
    useIsoLayoutEffect(() => {
      if (!shown) return
      mount("empty", true)
      return () => mount("empty", false)
    }, [mount, shown])
    // Development: the empty part is a sibling of the list, never inside it.
    useEffect(() => {
      if (process.env.NODE_ENV === "production") return
      if (ref.current?.closest('[role="listbox"]')) {
        console.warn(`[rind-ui] ${host.name}: Empty is inside the list; render it after List.`)
      }
    }, [host.name])
    if (!shown) return null
    return renderPart(
      "div",
      mergeProps({ ...normalizeProps(host.parts.empty()), ref }, rest),
      render,
      undefined,
    )
  }

  function LoadMore({ render, ...rest }: Own<"div">) {
    const host = useHost("LoadMore")
    const ref = useRef<HTMLDivElement | null>(null)
    const latest = useRef(host.requestLoadMore)
    latest.current = host.requestLoadMore
    useEffect(() => {
      const node = ref.current
      if (!node || typeof IntersectionObserver === "undefined") return
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) latest.current()
      })
      observer.observe(node)
      return () => observer.disconnect()
    }, [])
    return renderPart(
      "div",
      mergeProps({ ...normalizeProps(host.parts.loadMore()), ref }, rest),
      render,
      undefined,
    )
  }

  /** Data mode: every section and item of the collection, in render order. */
  function Items({ children }: { readonly children?: (label: string, key: string) => ReactNode }) {
    const host = useHost("Items")
    const c = host.collection
    const groups: { section: SectionNode | null; keys: CollectionKey[] }[] = []
    for (const node of c) {
      if (node.type === "section") groups.push({ section: node, keys: [] })
      else {
        const last = groups.at(-1)
        const owner = node.parentKey
        if (last && (last.section?.key ?? null) === owner) last.keys.push(node.key)
        else groups.push({ section: null, keys: [node.key] })
      }
    }
    const item = (key: CollectionKey) => {
      const node = c.get(key)
      return node ? (
        <Item key={key} value={key} textValue={node.textValue} disabled={node.disabled}>
          {children ? children(node.textValue, key) : <ItemText>{node.textValue}</ItemText>}
        </Item>
      ) : null
    }
    return groups.map((g, i) =>
      g.section ? (
        <Section key={g.section.key} section={g.section}>
          {g.keys.map(item)}
        </Section>
      ) : (
        // biome-ignore lint/suspicious/noArrayIndexKey: runs of sectionless items have no key of their own
        <Run key={`run-${i}`}>{g.keys.map(item)}</Run>
      ),
    )
  }
  const Run = ({ children }: { children?: ReactNode }) => <>{children}</>

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
