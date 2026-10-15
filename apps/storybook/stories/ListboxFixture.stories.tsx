import type { Meta, StoryObj } from "@storybook/react-vite"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
// The collection foundation fixture: not a public component (Select, Combobox... get their own).
import { FRUITS, ListboxExample } from "../../../packages/testing/fixtures/listbox/listbox.fixture"
import {
  fromData,
  Listbox,
  type ListboxItemData,
} from "../../../packages/testing/fixtures/listbox/listbox.react"

const meta = {
  title: "Internal/Listbox fixture",
  component: ListboxExample,
  excludeStories: ["states"],
} satisfies Meta<typeof ListboxExample>

/** State stories: contract scope → machine state → story export. */
export const states = { listbox: { idle: "Roving", focused: "Roving" } }

export default meta
type Story = StoryObj<typeof meta>

export const Roving: Story = { args: { strategy: "roving", selectionMode: "single" } }

export const ActiveDescendant: Story = {
  args: { strategy: "active-descendant", selectionMode: "single" },
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
export const Sections: Story = { args: { items: SECTIONED } }

const withDisabled = FRUITS.map((f) =>
  f.key === "banana" || f.key === "date" ? { ...f, disabled: true } : f,
)
export const DisabledItems: Story = {
  args: { items: withDisabled, focusableWhenDisabled: false },
}
export const DisabledItemsFocusable: Story = {
  args: { items: withDisabled, focusableWhenDisabled: true },
}

export const MultipleSelection: Story = {
  args: { selectionMode: "multiple", selectionBehavior: "replace" },
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
export const AsyncLoadMore: Story = { render: () => <LoadMore /> }

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

export const Virtualized: Story = { render: () => <VirtualizedList /> }
