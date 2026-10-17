"use client"

import { Listbox } from "@rind-ui/react"
import { type ReactNode, useState } from "react"
import type { States, Variants } from "./types"

/** `focused` needs real focus inside the list: it is reached by the driver. */
export const states: States = { listbox: { idle: "Single" } }

const FRUIT = ["Apple", "Banana", "Cherry", "Date", "Elderberry"]

function Row({ value, children }: { readonly value: string; readonly children?: ReactNode }) {
  return (
    <Listbox.Item value={value}>
      <Listbox.ItemText>{children ?? value}</Listbox.ItemText>
      <Listbox.ItemIndicator>✓</Listbox.ItemIndicator>
    </Listbox.Item>
  )
}

export function Single() {
  return (
    <Listbox.Root defaultValue="Banana">
      <Listbox.Label>Fruit</Listbox.Label>
      <Listbox.List>
        {FRUIT.map((f) => (
          <Row key={f} value={f} />
        ))}
      </Listbox.List>
    </Listbox.Root>
  )
}

export function Multiple() {
  const [value, setValue] = useState<readonly string[] | "all">(["Apple", "Cherry"])
  return (
    <div className="stack">
      <Listbox.Root selectionMode="multiple" value={value} onValueChange={setValue}>
        <Listbox.Label>Toppings (toggle)</Listbox.Label>
        <Listbox.List>
          {FRUIT.map((f) => (
            <Row key={f} value={f} />
          ))}
        </Listbox.List>
      </Listbox.Root>
      <span className="note">selected: {value === "all" ? "all" : value.join(", ") || "none"}</span>
    </div>
  )
}

export function MultipleReplace() {
  return (
    <Listbox.Root selectionMode="multiple" selectionBehavior="replace" defaultValue={["Apple"]}>
      <Listbox.Label>Files (replace)</Listbox.Label>
      <Listbox.List>
        {FRUIT.map((f) => (
          <Row key={f} value={f} />
        ))}
      </Listbox.List>
    </Listbox.Root>
  )
}

export function Actions() {
  const [last, setLast] = useState<string | null>(null)
  return (
    <div className="stack">
      <Listbox.Root selectionMode="none" onAction={setLast}>
        <Listbox.Label>Commands</Listbox.Label>
        <Listbox.List>
          {["Rename", "Duplicate", "Archive"].map((c) => (
            <Row key={c} value={c} />
          ))}
        </Listbox.List>
      </Listbox.Root>
      <span className="note">last action: {last ?? "none"}</span>
    </div>
  )
}

const Icon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <circle cx="8" cy="8" r="6" />
  </svg>
)

export function SectionsAndDescriptions() {
  return (
    <Listbox.Root defaultValue="ada">
      <Listbox.Label>Assignee</Listbox.Label>
      <Listbox.List>
        <Listbox.Section section={{ key: "design", label: "Design" }}>
          <Listbox.Item value="ada">
            <Icon />
            <Listbox.ItemText>Ada</Listbox.ItemText>
            <Listbox.ItemDescription>Lead designer</Listbox.ItemDescription>
          </Listbox.Item>
          <Listbox.Item value="grace">
            <Icon />
            <Listbox.ItemText>Grace</Listbox.ItemText>
            <Listbox.ItemDescription>Illustrator</Listbox.ItemDescription>
          </Listbox.Item>
        </Listbox.Section>
        <Listbox.Separator />
        <Listbox.Section section={{ key: "eng", label: "Engineering" }}>
          <Listbox.Item value="linus">
            <Icon />
            <Listbox.ItemText>Linus</Listbox.ItemText>
            <Listbox.ItemDescription>Platform</Listbox.ItemDescription>
          </Listbox.Item>
        </Listbox.Section>
      </Listbox.List>
    </Listbox.Root>
  )
}

export function DisabledOptions() {
  return (
    <Listbox.Root defaultValue="Apple">
      <Listbox.Label>Some unavailable</Listbox.Label>
      <Listbox.List>
        {FRUIT.map((f) => (
          <Listbox.Item key={f} value={f} disabled={f === "Banana" || f === "Date"}>
            <Listbox.ItemText>{f}</Listbox.ItemText>
          </Listbox.Item>
        ))}
      </Listbox.List>
    </Listbox.Root>
  )
}

export function HorizontalRtl() {
  return (
    <div className="stack">
      <Listbox.Root orientation="horizontal" defaultValue="one">
        <Listbox.Label>Left to right</Listbox.Label>
        <Listbox.List>
          <Row value="one">One</Row>
          <Row value="two">Two</Row>
          <Row value="three">Three</Row>
        </Listbox.List>
      </Listbox.Root>
      <div dir="rtl">
        <Listbox.Root orientation="horizontal" defaultValue="one">
          <Listbox.Label>من اليمين إلى اليسار</Listbox.Label>
          <Listbox.List>
            <Row value="one">واحد</Row>
            <Row value="two">اثنان</Row>
            <Row value="three">ثلاثة</Row>
          </Listbox.List>
        </Listbox.Root>
      </div>
    </div>
  )
}

export function Empty() {
  return (
    <Listbox.Root items={[]}>
      <Listbox.Label>Results</Listbox.Label>
      <Listbox.List />
      <Listbox.Empty>No results</Listbox.Empty>
    </Listbox.Root>
  )
}

const page = (n: number) =>
  Array.from({ length: 10 }, (_, i) => ({
    key: `item-${n * 10 + i + 1}`,
    label: `Item ${n * 10 + i + 1}`,
  }))

export function LoadMore() {
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const items = Array.from({ length: pages }, (_, n) => page(n)).flat()
  return (
    <Listbox.Root
      items={items}
      loading={loading ? "loading-more" : "idle"}
      onLoadMore={() => {
        if (pages >= 4) return
        setLoading(true)
        // A simulated request: the next page arrives after a moment.
        setTimeout(() => {
          setPages((p) => p + 1)
          setLoading(false)
        }, 600)
      }}
    >
      <Listbox.Label>Scroll for more</Listbox.Label>
      <Listbox.List>
        <Listbox.Items />
        <Listbox.LoadMore />
      </Listbox.List>
      {loading && <span className="note">Loading…</span>}
    </Listbox.Root>
  )
}

export const variants: Variants = {
  Single: {
    title: "Single",
    description: "One selected option; Arrow keys move, Space or Enter select.",
  },
  Multiple: { title: "Multiple (toggle)", description: "Each press adds or removes an option." },
  MultipleReplace: {
    title: "Multiple (replace)",
    description: "A press selects only that option; Ctrl or Cmd adds, Shift extends a range.",
  },
  Actions: {
    title: "Action list",
    description: '`selectionMode="none"`: Enter or a press runs `onAction`.',
  },
  SectionsAndDescriptions: {
    title: "Sections, descriptions and icons",
    description:
      "The icon is decorative; the name is the ItemText, the description is read after it.",
  },
  DisabledOptions: {
    title: "Disabled items",
    description: "Skipped by the keys and by typeahead.",
  },
  HorizontalRtl: {
    title: "Horizontal and RTL",
    description: "Arrow Right moves forward in the left-to-right list and backward in the RTL one.",
  },
  Empty: { title: "Empty", description: "`Listbox.Empty` after the list names the list's state." },
  LoadMore: {
    title: "Load more",
    description:
      "`onLoadMore` fires when the sentinel scrolls into view; `loading` shows the state.",
  },
}
