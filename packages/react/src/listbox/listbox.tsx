// Listbox: the Root hosting the listbox parts. Wiring only: the machine owns highlight,
// selection and typeahead; the core parts own every attribute.

import {
  type Collection,
  type CollectionKey,
  createListCollection,
  type FocusStrategy,
  type ListboxActionDetails,
  type ListboxValue,
  type LoadingStatus,
  listboxConnect,
  listboxIds,
  listboxMachine,
  type ScrollToIndexDetails,
  selectionOf,
} from "@rind-ui/core"
import { createContext, type ReactNode, useContext, useMemo, useRef, useState } from "react"
import { useEnvironment } from "../provider"
import { useCollectionIdentityWarning, useCollectionItems } from "../use-collection-items"
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
  readonly id?: string
  readonly children?: ReactNode
  readonly orientation?: "vertical" | "horizontal"
  readonly disabled?: boolean
  readonly focusableWhenDisabled?: boolean
  readonly disabledBehavior?: "all" | "selection"
  readonly loop?: boolean
  readonly typeaheadTimeout?: number
  /** Data items. Without them (and without `collection`), item parts register themselves. */
  readonly items?: readonly ListboxItemData[]
  /** A collection built by the consumer (virtualized lists). */
  readonly collection?: Collection<unknown>
  readonly loading?: LoadingStatus
  readonly onLoadMore?: () => void
  readonly virtualized?: boolean
  readonly scrollToIndex?: (details: ScrollToIndexDetails) => void
  readonly strategy?: FocusStrategy
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

const HostContext = createContext<ListboxHost | null>(null)
const useListboxHost = (part: string): ListboxHost => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`Listbox.${part} must be inside Listbox.Root`)
  return host
}

function Root(all: ListboxRootProps) {
  const {
    id,
    items,
    collection: given,
    children,
    strategy = "roving",
    orientation = "vertical",
    disabled = false,
  } = all
  const p = all as Record<string, unknown>
  const env = useEnvironment()
  const instance = useRootId(id)
  const { collection: registered, registry } = useCollectionItems()
  const data = useMemo(() => (items ? fromData(items) : null), [items])
  const collection = given ?? data ?? registered ?? EMPTY
  useCollectionIdentityWarning(collection, "Listbox")
  const ids = useMemo(() => listboxIds("listbox", instance), [instance])
  const selectionMode =
    (p["selectionMode"] as "single" | "multiple" | "none" | undefined) ?? "single"
  const selectionBehavior = (p["selectionBehavior"] as "toggle" | "replace" | undefined) ?? "toggle"
  const onAction = p["onAction"] as ((key: string, d: ListboxActionDetails) => void) | undefined
  const latest = useRef({
    onValueChange: p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined,
    onAction,
  })
  latest.current = {
    onValueChange: p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined,
    onAction,
  }
  const { service } = useMachine(listboxMachine, {
    collection,
    ids,
    strategy,
    orientation,
    selectionMode,
    selectionBehavior,
    disabled,
    disallowEmptySelection: p["disallowEmptySelection"] as boolean | undefined,
    disabledBehavior: all.disabledBehavior,
    focusableWhenDisabled: all.focusableWhenDisabled,
    loop: all.loop,
    typeaheadTimeout: all.typeaheadTimeout,
    loading: all.loading,
    onLoadMore: all.onLoadMore,
    virtualized: all.virtualized,
    scrollToIndex: all.scrollToIndex,
    ...("value" in all ? { value: p["value"] as ListboxValue } : {}),
    defaultValue:
      (p["defaultValue"] as ListboxValue | undefined) ?? (selectionMode === "multiple" ? [] : null),
    onValueChange: (v, details) => {
      const e = details.event as { type: string; key?: string }
      latest.current.onValueChange?.(v, { reason: e.type, key: e.key })
    },
    onAction: onAction ? (key, d) => latest.current.onAction?.(key, d) : undefined,
  })
  const view = service.view()
  const [mounted, setMounted] = useState<{
    label: boolean
    empty: boolean
    descriptions: ReadonlySet<CollectionKey>
  }>({ label: false, empty: false, descriptions: new Set() })
  const [mount] = useState(
    () => (part: "label" | "empty", on: boolean) =>
      setMounted((m) => (m[part] === on ? m : { ...m, [part]: on })),
  )
  const [mountDescription] = useState(
    () => (key: CollectionKey, on: boolean) =>
      setMounted((m) => {
        if (m.descriptions.has(key) === on) return m
        const next = new Set(m.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        return { ...m, descriptions: next }
      }),
  )
  const focused = view.matches("focused")
  const modality = useModality(env.modality, focused)
  const loadedFor = useRef<Collection<unknown> | null>(null)
  const parts = listboxConnect(
    {
      instance,
      collection,
      context: view.context,
      selection: selectionOf(view.values.value),
      selectionMode,
      selectionBehavior,
      orientation,
      strategy,
      disabled,
      focusableWhenDisabled: all.focusableWhenDisabled,
      disabledBehavior: all.disabledBehavior,
      loading: all.loading,
      pending: !given && !data && registered === null,
      typingAhead: () => {
        const t = service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (all.typeaheadTimeout ?? 1000)
      },
      actions: onAction !== undefined,
      focused,
      modality,
      mounted: {
        label: mounted.label,
        empty: mounted.empty,
        description: (key) => mounted.descriptions.has(key),
      },
      send: service.send,
    },
    env,
  )
  const host: ListboxHost = {
    name: "Listbox",
    parts,
    collection,
    registry: given || data ? null : registry,
    mount,
    mountDescription,
    requestLoadMore: () => {
      if ((all.loading ?? "idle") !== "idle" || loadedFor.current === collection) return
      loadedFor.current = collection
      all.onLoadMore?.()
    },
    service: service as unknown as ListboxHost["service"],
    itemSignature: (raw, key) => {
      // Sound: this host's service is the listbox machine's.
      const v = raw as ReturnType<typeof service.view>
      const c = v.context
      const highlighted = c.highlightedKey === key
      return [
        highlighted,
        highlighted ? c.highlightSource : null,
        JSON.stringify(v.values.value),
        c.highlightedKey === null || highlighted,
        collection.get(key)?.index,
        collection.size,
      ].join("|")
    },
  }
  return <HostContext value={host}>{children}</HostContext>
}

const parts = createListboxParts(useListboxHost)

export const Listbox = { Root, ...parts }
