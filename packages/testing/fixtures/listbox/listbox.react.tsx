import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  type FocusStrategy,
  focusAttrs,
  type ItemRegistry,
  layoutCapability,
  type SectionNode,
  type Service,
  toKey,
} from "@rind-ui/core"
import {
  mergeProps,
  normalizeProps,
  useCollectionIdentityWarning,
  useCollectionItems,
  useEnvironment,
  useMachine,
  useModality,
  useRegisterItem,
  useRootId,
  useSelector,
} from "@rind-ui/react"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { connect, listboxIds } from "./listbox.connect"
import { type ListboxMachine, type ListboxProps, listboxMachine } from "./listbox.machine"

/** One item of a data-driven listbox. */
export interface ListboxItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly section?: { readonly key: string; readonly label: string }
}

export const fromData = (items: readonly ListboxItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])

interface Ctx {
  readonly service: Service<ListboxMachine>
  readonly root: string
  readonly registry: ItemRegistry | null
  readonly pending: boolean
  readonly props: ListboxProps
}
const ListboxCtx = createContext<Ctx | null>(null)
const SectionCtx = createContext<{ key: string; label: string } | undefined>(undefined)
const useListbox = (part: string) => {
  const ctx = useContext(ListboxCtx)
  if (!ctx) throw new Error(`Listbox.${part} must be inside Listbox.Root`)
  return ctx
}

export interface RootProps
  extends Omit<ListboxProps, "collection" | "ids" | "strategy" | "orientation"> {
  readonly id?: string
  readonly strategy?: FocusStrategy
  readonly orientation?: "vertical" | "horizontal"
  /** Data items. Without them (and without `collection`), item parts register themselves. */
  readonly items?: readonly ListboxItemData[]
  /** A collection built by the consumer (virtualized lists). */
  readonly collection?: Collection<unknown>
  readonly children?: ReactNode
}

function Root({
  id,
  items,
  collection: given,
  children,
  strategy,
  orientation,
  ...rest
}: RootProps) {
  const root = useRootId(id)
  const { collection: registered, registry } = useCollectionItems()
  const data = useMemo(() => (items ? fromData(items) : null), [items])
  const collection = given ?? data ?? registered ?? EMPTY
  useCollectionIdentityWarning(collection, "Listbox")
  const ids = useMemo(() => listboxIds(root), [root])
  const props: ListboxProps = {
    ...rest,
    collection,
    ids,
    strategy: strategy ?? "roving",
    orientation: orientation ?? "vertical",
  }
  const env = useEnvironment(announcerCapability, layoutCapability)
  const { service } = useMachine(listboxMachine, props, env)
  const pending = !given && !data && registered === null
  // Rebuilt with the props on every Root render (the parts read the props from it).
  const ctx: Ctx = { service, root, registry: given || data ? null : registry, pending, props }
  return <ListboxCtx value={ctx}>{children}</ListboxCtx>
}

/** The parts' props from the current view. */
function useParts(ctx: Ctx) {
  const env = useEnvironment()
  const view = ctx.service.view()
  const p = ctx.props
  return connect(
    {
      collection: p.collection,
      context: view.context,
      value: view.values.value,
      strategy: p.strategy,
      selectionMode: p.selectionMode ?? "none",
      orientation: p.orientation ?? "vertical",
      focusableWhenDisabled: p.focusableWhenDisabled,
      disabledBehavior: p.disabledBehavior,
      loading: p.loading,
      pending: ctx.pending,
      typingAhead: () => {
        const t = ctx.service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (p.typeaheadTimeout ?? 1000)
      },
    },
    ctx.service.send,
    env,
    ctx.root,
  )
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly children?: ReactNode
}

function List({ children, ...rest }: Own<"div">) {
  const ctx = useListbox("List")
  // The list follows the whole view (highlight, loading, emptiness).
  useSelector(ctx.service, (v) => v)
  const parts = useParts(ctx)
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the list is mounted: a first tap on an
  // item must already read "touch".
  useEffect(() => env.modality.subscribe(() => {}), [env])
  // The list itself holds focus when no item can (empty, all disabled) or in active-descendant.
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const own = {
    // A pointer move ends the keyboard session: no ring until the next key.
    ...focusAttrs(
      focused,
      ctx.service.getSnapshot().context.highlightSource === "pointer" ? "pointer" : modality,
    ),
    onFocus: (e: { target: EventTarget; currentTarget: EventTarget }) =>
      setFocused(e.target === e.currentTarget),
    onBlur: (e: { target: EventTarget; currentTarget: EventTarget }) => {
      if (e.target === e.currentTarget) setFocused(false)
    },
  }
  return (
    <div {...mergeProps(normalizeProps(parts.list()), own, rest as Record<string, unknown>)}>
      {children}
    </div>
  )
}

export interface ItemProps extends Own<"div"> {
  /** The item key. */
  readonly value: string
  readonly textValue?: string
  readonly disabled?: boolean
  readonly keywords?: readonly string[]
}

/** What an item renders from: changes for two items when the highlight moves. */
function itemSignature(ctx: Ctx, key: CollectionKey) {
  const v = ctx.service.view()
  const c = v.context
  const highlighted = c.highlightedKey === key
  return [
    highlighted,
    highlighted ? c.highlightSource : null,
    v.values.value.includes(key),
    // The tab stop moves with the highlight (or with the selection when nothing is).
    c.highlightedKey === null || highlighted,
    ctx.props.collection.get(key)?.index,
    ctx.props.collection.size,
  ].join("|")
}

function Item({ value, textValue, disabled, keywords, children, ...rest }: ItemProps) {
  const ctx = useListbox("Item")
  const key = toKey(value)
  const section = useContext(SectionCtx)
  const ref = useRef<HTMLDivElement | null>(null)
  useRegisterItem(ctx.registry, { key: value, textValue, disabled, keywords, section }, ref)
  useSelector(ctx.service, () => itemSignature(ctx, key))
  const parts = useParts(ctx)
  const props = mergeProps(
    normalizeProps(parts.item(key)),
    { ref },
    rest as Record<string, unknown>,
  )
  return <div {...props}>{children}</div>
}

function Section({
  section,
  children,
}: {
  section: SectionNode | { key: string; label: string }
  children?: ReactNode
}) {
  const ctx = useListbox("Section")
  const parts = useParts(ctx)
  const node: SectionNode = { type: "section", key: toKey(section.key), label: section.label }
  return (
    <div {...normalizeProps(parts.section(node))}>
      <div {...normalizeProps(parts.sectionLabel(node))}>{section.label}</div>
      <SectionCtx value={{ key: section.key, label: section.label }}>{children}</SectionCtx>
    </div>
  )
}

/** Data mode: every section and item of the collection, in render order. */
function Items({ render }: { render?: (label: string, key: string) => ReactNode }) {
  const ctx = useListbox("Items")
  const c = ctx.props.collection
  const groups: { section: SectionNode | null; keys: CollectionKey[] }[] = []
  for (const node of c) {
    if (node.type === "section") groups.push({ section: node, keys: [] })
    else {
      const last = groups.at(-1)
      const owner = node.parentKey === null ? null : node.parentKey
      if (last && (last.section?.key ?? null) === owner) last.keys.push(node.key)
      else groups.push({ section: null, keys: [node.key] })
    }
  }
  const item = (key: CollectionKey) => {
    const node = c.get(key)
    return node ? (
      <Item key={key} value={key} textValue={node.textValue} disabled={node.disabled}>
        {render ? render(node.textValue, key) : node.textValue}
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
      <SectionlessRun key={`run-${i}`}>{g.keys.map(item)}</SectionlessRun>
    ),
  )
}
const SectionlessRun = ({ children }: { children?: ReactNode }) => <>{children}</>

/** Inside Root: the keys a virtualizer must keep mounted (`rangeExtractor`). */
function usePersistedKeys(): readonly CollectionKey[] {
  const ctx = useListbox("usePersistedKeys")
  return useSelector(
    ctx.service,
    (v) => v.computed.persistedKeys,
    (a, b) => a.length === b.length && a.every((k, i) => k === b[i]),
  )
}

export const Listbox = { Root, List, Item, Section, Items, usePersistedKeys }
