/** @jsxImportSource solid-js */
// Listbox: the Root hosting the listbox parts. Wiring only: the machine owns highlight,
// selection and typeahead; the core parts own every attribute.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  type FocusStrategy,
  type ListboxActionDetails,
  type ListboxValue,
  type LoadingStatus,
  layoutCapability,
  listboxConnect,
  listboxIds,
  listboxMachine,
  type ScrollToIndexDetails,
  selectionOf,
} from "@rind-ui/core"
import { createContext, createMemo, createSignal, type JSX, useContext } from "solid-js"
import { useEnvironment } from "../provider"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { createListboxParts, type ListboxHost } from "./parts"

/** One item of a data-driven listbox. */
export interface ListboxItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly section?: { readonly key: string; readonly label: string }
}

const fromData = (items: readonly ListboxItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])

export interface ListboxChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}

type Common = {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id?: string | undefined
  /** The listbox parts. */
  readonly children?: JSX.Element
  readonly orientation?: "vertical" | "horizontal" | undefined
  readonly disabled?: boolean | undefined
  /** A disabled list keeps its Tab stop and disabled items stay reachable (not selectable). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** `all`: disabled items are skipped and not actionable; `selection`: reachable, only not selectable. Default: `"all"`. */
  readonly disabledBehavior?: "all" | "selection" | undefined
  /** Arrow keys wrap from the last item to the first and back. Default: `false`. */
  readonly loop?: boolean | undefined
  /** How long typed characters build one typeahead search (ms). Default: 1000. */
  readonly typeaheadTimeout?: number | undefined
  /** Data items. Without them (and without `collection`), item parts register themselves. */
  readonly items?: readonly ListboxItemData[] | undefined
  /** A collection built by the consumer (virtualized lists). */
  readonly collection?: Collection<unknown> | undefined
  readonly loading?: LoadingStatus | undefined
  readonly onLoadMore?: (() => void) | undefined
  /** Items are not all rendered: the highlighted item is scrolled through `scrollToIndex`, never `scrollIntoView`. */
  readonly virtualized?: boolean | undefined
  /** Scrolls the highlighted item into view on navigation, typeahead and open (replaces `scrollIntoView`). */
  readonly scrollToIndex?: ((details: ScrollToIndexDetails) => void) | undefined
  /** `roving`: DOM focus moves to the item; `active-descendant`: focus stays on the list. Default: `"roving"`. */
  readonly strategy?: FocusStrategy | undefined
}

/** Actions exist where they cannot clash with selection keys: none mode or replace. */
type Selection =
  | {
      readonly selectionMode?: "single"
      readonly value?: string | null
      readonly defaultValue?: string | null
      readonly onValueChange?: (value: string | null, details: ListboxChangeDetails) => void
    }
  | {
      readonly selectionMode: "multiple"
      readonly value?: readonly string[] | "all"
      readonly defaultValue?: readonly string[] | "all"
      readonly onValueChange?: (
        value: readonly string[] | "all",
        details: ListboxChangeDetails,
      ) => void
      /** No user action leaves the selection empty. */
      readonly disallowEmptySelection?: boolean
    }
  | {
      readonly selectionMode: "none"
      readonly onAction?: (key: string, details: ListboxActionDetails) => void
    }

type Behaviour =
  | { readonly selectionBehavior?: "toggle"; readonly onAction?: never }
  | {
      readonly selectionBehavior: "replace"
      readonly onAction?: (key: string, details: ListboxActionDetails) => void
    }

export type ListboxRootProps = Common & Selection & (Behaviour | { readonly selectionMode: "none" })

const HostContext = createContext<ListboxHost>()
const useListboxHost = (part: string): ListboxHost => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`Listbox.${part} must be inside Listbox.Root`)
  return host
}

function Root(all: ListboxRootProps) {
  // Read through accessors: the selection variants share no static shape.
  const p = all as Record<string, unknown> & Common
  const env = useEnvironment(announcerCapability, layoutCapability)
  const instance = useRootId(() => p.id)
  const { collection: registered, registry } = useCollectionItems()
  const data = createMemo(() => (p.items ? fromData(p.items) : null))
  const collection = createMemo(() => p.collection ?? data() ?? registered() ?? EMPTY)
  const ids = createMemo(() => listboxIds("listbox", instance()))
  const strategy = () => p.strategy ?? "roving"
  const orientation = () => p.orientation ?? "vertical"
  const selectionMode = () =>
    (p["selectionMode"] as "single" | "multiple" | "none" | undefined) ?? "single"
  const selectionBehavior = () =>
    (p["selectionBehavior"] as "toggle" | "replace" | undefined) ?? "toggle"
  const onAction = () =>
    p["onAction"] as ((key: string, d: ListboxActionDetails) => void) | undefined
  const { view, service } = useMachine(
    listboxMachine,
    () => ({
      collection: collection(),
      ids: ids(),
      strategy: strategy(),
      orientation: orientation(),
      selectionMode: selectionMode(),
      selectionBehavior: selectionBehavior(),
      disabled: p.disabled === true,
      disallowEmptySelection: p["disallowEmptySelection"] as boolean | undefined,
      disabledBehavior: p.disabledBehavior,
      focusableWhenDisabled: p.focusableWhenDisabled,
      loop: p.loop,
      typeaheadTimeout: p.typeaheadTimeout,
      loading: p.loading,
      onLoadMore: p.onLoadMore,
      virtualized: p.virtualized,
      scrollToIndex: p.scrollToIndex,
      ...("value" in all ? { value: p["value"] as ListboxValue } : {}),
      defaultValue:
        (p["defaultValue"] as ListboxValue | undefined) ??
        (selectionMode() === "multiple" ? [] : null),
      onValueChange: (v: ListboxValue, details: { event: unknown }) => {
        const e = details.event as { type: string; key?: string }
        ;(p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined)?.(v, {
          reason: e.type,
          key: e.key,
        })
      },
      onAction: onAction()
        ? (key: string, d: ListboxActionDetails) => onAction()?.(key, d)
        : undefined,
    }),
    env,
  )
  const [mounted, setMounted] = createSignal<{
    label: boolean
    empty: boolean
    descriptions: ReadonlySet<CollectionKey>
  }>({ label: false, empty: false, descriptions: new Set() })
  const mount = (part: "label" | "empty", on: boolean) =>
    setMounted((m) => (m[part] === on ? m : { ...m, [part]: on }))
  const mountDescription = (key: CollectionKey, on: boolean) =>
    setMounted((m) => {
      if (m.descriptions.has(key) === on) return m
      const next = new Set(m.descriptions)
      if (on) next.add(key)
      else next.delete(key)
      return { ...m, descriptions: next }
    })
  const focused = () => view().matches("focused")
  const modality = useModality(env.modality, focused)
  let loadedFor: Collection<unknown> | null = null
  const parts = createMemo(() =>
    listboxConnect(
      {
        instance: instance(),
        collection: collection(),
        context: view().context,
        selection: selectionOf(view().values.value),
        selectionMode: selectionMode(),
        selectionBehavior: selectionBehavior(),
        orientation: orientation(),
        strategy: strategy(),
        disabled: p.disabled === true,
        focusableWhenDisabled: p.focusableWhenDisabled,
        disabledBehavior: p.disabledBehavior,
        loading: p.loading,
        pending: !p.collection && !data() && registered() === null,
        typingAhead: () => {
          const t = service.getSnapshot().context.typeahead
          return t.buffer !== "" && env.clock.now() - t.at <= (p.typeaheadTimeout ?? 1000)
        },
        actions: onAction() !== undefined,
        focused: focused(),
        modality: modality(),
        mounted: {
          label: mounted().label,
          empty: mounted().empty,
          description: (key: CollectionKey) => mounted().descriptions.has(key),
        },
        send: service.send,
      },
      env,
    ),
  )
  const host: ListboxHost = {
    name: "Listbox",
    parts,
    collection,
    registry: p.collection || p.items ? null : registry,
    mount,
    mountDescription,
    requestLoadMore: () => {
      if ((p.loading ?? "idle") !== "idle" || loadedFor === collection()) return
      loadedFor = collection()
      p.onLoadMore?.()
    },
  }
  // The Root renders no element: the List is the listbox.
  return <HostContext.Provider value={host}>{p.children}</HostContext.Provider>
}

const parts = createListboxParts(useListboxHost)

const {
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
} = parts

/** The parts, by name: `listbox.parts.ts` re-exports them as the `Listbox` namespace. */
export {
  Empty,
  Item,
  ItemDescription,
  ItemIndicator,
  Items,
  ItemText,
  Label,
  List,
  LoadMore,
  Root,
  Section,
  Separator,
}
