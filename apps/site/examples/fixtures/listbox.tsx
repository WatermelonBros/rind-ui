"use client"

// Ported from apps/storybook/stories/ListboxFixture.stories.tsx
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
// The collection foundation fixture: not a public component (Select, Combobox... get their own).
import {
  FRUITS,
  ListboxExample,
} from "../../../../packages/testing/fixtures/listbox/listbox.fixture"
import {
  fromData,
  Listbox,
  type ListboxItemData,
} from "../../../../packages/testing/fixtures/listbox/listbox.react"
import type { States, Variants } from "../types"

export const states: States = { listbox: { idle: "Roving", focused: "Roving" } }

export function Roving() {
  return <ListboxExample strategy="roving" selectionMode="single" />
}

export function ActiveDescendant() {
  return <ListboxExample strategy="active-descendant" selectionMode="single" />
}

const SECTIONED: readonly ListboxItemData[] = [
  ...["apple", "banana", "cherry"].map((key) => ({
    key,
    label: key[0]?.toUpperCase() + key.slice(1),
    section: { key: "fruit", label: "Fruit" },
  })),
  ...["carrot", "leek"].map((key) => ({
    key,
    label: key[0]?.toUpperCase() + key.slice(1),
    section: { key: "veg", label: "Vegetables" },
  })),
]
export function Sections() {
  return <ListboxExample items={SECTIONED} />
}

const withDisabled = FRUITS.map((f) =>
  f.key === "banana" || f.key === "date" ? { ...f, disabled: true } : f,
)
export function DisabledItems() {
  return <ListboxExample items={withDisabled} focusableWhenDisabled={false} />
}
export function DisabledItemsFocusable() {
  return <ListboxExample items={withDisabled} focusableWhenDisabled />
}

export function MultipleSelection() {
  return <ListboxExample selectionMode="multiple" selectionBehavior="replace" />
}

const page = (from: number): ListboxItemData[] =>
  Array.from({ length: 10 }, (_, i) => ({
    key: `item-${from + i}`,
    label: `Item ${from + i + 1}`,
  }))

function LoadMore() {
  const [items, setItems] = useState(() => page(0))
  const [loading, setLoading] = useState(false)
  // The machine can ask again while a page is in flight: one request at a time.
  const busy = useRef(false)
  const onLoadMore = useCallback(() => {
    if (busy.current || items.length >= 30) return
    busy.current = true
    setLoading(true)
    setTimeout(() => {
      setItems((prev) => [...prev, ...page(prev.length)])
      setLoading(false)
      busy.current = false
    }, 300)
  }, [items.length])
  return (
    <div>
      <span id="more-label">Pages</span>
      <Listbox.Root
        items={items}
        loading={loading ? "loading-more" : "idle"}
        onLoadMore={onLoadMore}
      >
        <Listbox.List aria-labelledby="more-label" style={{ maxHeight: 200, overflow: "auto" }}>
          <Listbox.Items />
        </Listbox.List>
      </Listbox.Root>
    </div>
  )
}
export function AsyncLoadMore() {
  return <LoadMore />
}

const MANY = fromData(
  Array.from({ length: 10_000 }, (_, i) => ({ key: `row-${i}`, label: `Row ${i + 1}` })),
)
const ROW = 28

/** Inside Root: only the virtual rows are mounted; the highlighted/selected keys stay mounted. */
function VirtualRows({ scrollTo }: { scrollTo: { current: (index: number) => void } }) {
  const persisted = Listbox.usePersistedKeys()
  const scroller = useRef<HTMLDivElement>(null)
  const persistedIndexes = persisted.flatMap((k) => MANY.get(k)?.index ?? [])
  const virtualizer = useVirtualizer({
    count: MANY.size,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW,
    overscan: 5,
    rangeExtractor: (range) =>
      [...new Set([...defaultRangeExtractor(range), ...persistedIndexes])].sort((a, b) => a - b),
  })
  useEffect(() => {
    scrollTo.current = (index) => virtualizer.scrollToIndex(index)
  }, [scrollTo, virtualizer])
  return (
    <Listbox.List
      ref={scroller}
      aria-labelledby="virtual-label"
      style={{ height: 240, overflow: "auto", position: "relative" }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const node = MANY.at(row.index)
          return node ? (
            <Listbox.Item
              key={node.key}
              value={node.key}
              style={{
                position: "absolute",
                insetBlockStart: 0,
                inlineSize: "100%",
                blockSize: ROW,
                transform: `translateY(${row.start}px)`,
              }}
            >
              {node.textValue}
            </Listbox.Item>
          ) : null
        })}
      </div>
    </Listbox.List>
  )
}

function VirtualizedList() {
  // The scroll callback needs the virtualizer, which lives in the child: bridge through a ref.
  const scrollTo = useRef<(index: number) => void>(() => {})
  const collection = useMemo(() => MANY, [])
  return (
    <div>
      <span id="virtual-label">Rows</span>
      <Listbox.Root
        collection={collection}
        strategy="roving"
        virtualized
        scrollToIndex={({ index }) => scrollTo.current(index)}
      >
        <VirtualRows scrollTo={scrollTo} />
      </Listbox.Root>
    </div>
  )
}

export function Virtualized() {
  return <VirtualizedList />
}

export const variants: Variants = {
  Roving: { title: "Roving", hidden: true },
  ActiveDescendant: { title: "Active descendant", hidden: true },
  Sections: { title: "Sections", hidden: true },
  DisabledItems: { title: "Disabled items", hidden: true },
  DisabledItemsFocusable: { title: "Disabled items focusable", hidden: true },
  MultipleSelection: { title: "Multiple selection", hidden: true },
  AsyncLoadMore: { title: "Async load more", hidden: true },
  Virtualized: { title: "Virtualized", hidden: true },
}
