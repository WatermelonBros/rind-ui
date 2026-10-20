"use client"

// Static item parts → a collection: each part registers at commit time; the root receives
// one collection per commit (and keeps the same instance when nothing changed, so the
// machine sees no collection change).

import {
  type Collection,
  createItemRegistry,
  createListCollection,
  type ItemRegistration,
  type ItemRegistry,
  type RegisteredItem,
} from "@rind-ui/core"
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react"

declare const process: { env: { NODE_ENV?: string } }

const sameItems = (c: Collection<RegisteredItem> | null, items: readonly RegisteredItem[]) => {
  if (!c || c.size !== items.length) return false
  return items.every((it, i) => {
    const node = c.at(i)
    const prev = node?.value
    return (
      prev !== undefined &&
      prev.key === it.key &&
      prev.textValue === it.textValue &&
      (prev.disabled ?? false) === (it.disabled ?? false) &&
      prev.section?.key === it.section?.key &&
      prev.section?.label === it.section?.label &&
      (prev.keywords ?? []).join("\u0000") === (it.keywords ?? []).join("\u0000")
    )
  })
}

const toCollection = (items: readonly RegisteredItem[]) =>
  createListCollection({
    items,
    getKey: (it) => it.key,
    getText: (it) => it.textValue,
    getKeywords: (it) => it.keywords ?? [],
    isDisabled: (it) => it.disabled === true,
    getSection: (it) => it.section,
  })

/**
 * The collection of the item parts registered through `registry`; null until the first
 * commit's items have registered (the server render and first paint).
 */
export function useCollectionItems(): {
  readonly collection: Collection<RegisteredItem> | null
  readonly registry: ItemRegistry
} {
  const [collection, setCollection] = useState<Collection<RegisteredItem> | null>(null)
  const [registry] = useState(() =>
    createItemRegistry((items) =>
      setCollection((prev) => (sameItems(prev, items) ? prev : toCollection(items))),
    ),
  )
  // After the items' layout effects of this commit (a parent's run last): the collection
  // is known in the same commit (no extra paint, and inside a test's act scope).
  useLayoutEffect(() => registry.flush())
  return { collection, registry }
}

/**
 * Registers an item part's element with the root's registry, at commit time. A null
 * registry (data-driven collection) registers nothing.
 */
export function useRegisterItem(
  registry: ItemRegistry | null,
  item: Omit<ItemRegistration, "element">,
  ref: RefObject<Element | null>,
): void {
  const { key, textValue, disabled } = item
  // Compared by value: a new section object or keywords array with equal content is the same.
  const sectionKey = item.section?.key
  const sectionLabel = item.section?.label
  const keywords = (item.keywords ?? []).join("\u0000")
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !registry) return
    return registry.register({
      key,
      textValue,
      disabled,
      section:
        sectionKey === undefined ? undefined : { key: sectionKey, label: sectionLabel ?? "" },
      keywords: keywords === "" ? [] : keywords.split("\u0000"),
      element,
    })
  }, [registry, ref, key, textValue, disabled, sectionKey, sectionLabel, keywords])
}

/**
 * Development: warns once when a consumer builds a new collection instance with the same
 * keys on every commit (10 in a row): each rebuild is O(n) plus a repair pass (useMemo it).
 */
export function useCollectionIdentityWarning(collection: Collection<unknown>, name: string): void {
  const last = useRef<Collection<unknown> | null>(null)
  const streak = useRef(0)
  const warned = useRef(false)
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || warned.current) return
    const prev = last.current
    last.current = collection
    if (!prev || prev === collection || prev.size !== collection.size) {
      streak.current = 0
      return
    }
    for (let i = 0; i < collection.size; i++) {
      if (prev.at(i)?.key !== collection.at(i)?.key) {
        streak.current = 0
        return
      }
    }
    streak.current++
    if (streak.current >= 10) {
      warned.current = true
      console.warn(
        `[rind-ui] ${name}: the collection is a new instance with the same keys on every render; memoise it (useMemo) to avoid rebuilding and repairing it each time`,
      )
    }
  })
}
