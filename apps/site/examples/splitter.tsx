"use client"

import { Button, Splitter, type SplitterRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/** A Splitter cannot be left mid-drag by a static render: `dragging` is reached by the driver. */
export const states: States = { splitter: { idle: "Basic" } }

/** Two panels named after their content, one handle named after the first. */
function Pair({
  first,
  second,
  ...props
}: Omit<SplitterRootProps, "panels"> & {
  readonly first: string
  readonly second: string
  readonly panels?: SplitterRootProps["panels"]
}) {
  return (
    <Splitter.Root panels={[{ min: 15 }, { min: 15 }]} {...props}>
      <Splitter.Panel index={0}>{first}</Splitter.Panel>
      <Splitter.Handle index={0} aria-label={first} />
      <Splitter.Panel index={1}>{second}</Splitter.Panel>
    </Splitter.Root>
  )
}

export function Basic() {
  return <Pair first="Files" second="Editor" defaultSizes={[30, 70]} />
}

export function Vertical() {
  return <Pair first="Code" second="Terminal" orientation="vertical" defaultSizes={[65, 35]} />
}

export function ThreePanels() {
  return (
    <Splitter.Root panels={[{ min: 15 }, { min: 20 }, { min: 15 }]} defaultSizes={[20, 50, 30]}>
      <Splitter.Panel index={0}>Inbox</Splitter.Panel>
      <Splitter.Handle index={0} aria-label="Inbox" />
      <Splitter.Panel index={1}>Message</Splitter.Panel>
      <Splitter.Handle index={1} aria-label="Message" />
      <Splitter.Panel index={2}>Details</Splitter.Panel>
    </Splitter.Root>
  )
}

/** The button is the single-pointer alternative to dragging (WCAG 2.5.7). */
export function Collapsible() {
  const [sizes, setSizes] = useState<readonly number[]>([30, 70])
  const collapsed = sizes[0] === 0
  return (
    <div className="stack">
      <Splitter.Root
        panels={[{ collapsible: true, min: 20 }, {}]}
        sizes={sizes}
        onSizesChange={setSizes}
      >
        <Splitter.Panel index={0}>Sidebar</Splitter.Panel>
        <Splitter.Handle index={0} aria-label="Sidebar" />
        <Splitter.Panel index={1}>Content</Splitter.Panel>
      </Splitter.Root>
      <div className="row">
        <Button onClick={() => setSizes(collapsed ? [30, 70] : [0, 100])}>
          {collapsed ? "Show sidebar" : "Hide sidebar"}
        </Button>
      </div>
    </div>
  )
}

export function PixelMinimum() {
  return (
    <Pair
      first="Navigation"
      second="Page"
      panels={[{ min: "160px", max: "60%" }, { min: "120px" }]}
      defaultSizes={[25, 75]}
    />
  )
}

export function Nested() {
  return (
    <Splitter.Root panels={[{ min: 20 }, { min: 30 }]} defaultSizes={[30, 70]}>
      <Splitter.Panel index={0}>Outline</Splitter.Panel>
      <Splitter.Handle index={0} aria-label="Outline" />
      <Splitter.Panel index={1}>
        <Pair first="Source" second="Output" orientation="vertical" />
      </Splitter.Panel>
    </Splitter.Root>
  )
}

export function Rtl() {
  return <Pair first="Files" second="Editor" defaultSizes={[30, 70]} dir="rtl" />
}

export function DisabledHandle() {
  return (
    <Splitter.Root panels={[{}, {}, {}]}>
      <Splitter.Panel index={0}>Fixed</Splitter.Panel>
      <Splitter.Handle index={0} aria-label="Fixed" disabled />
      <Splitter.Panel index={1}>Resizable</Splitter.Panel>
      <Splitter.Handle index={1} aria-label="Resizable" />
      <Splitter.Panel index={2}>Last</Splitter.Panel>
    </Splitter.Root>
  )
}

export function SaveLayout() {
  const [saved, setSaved] = useState<readonly number[] | null>(null)
  return (
    <div className="stack">
      <Pair
        first="List"
        second="Detail"
        defaultSizes={[40, 60]}
        onSizesCommit={(sizes) => setSaved(sizes)}
      />
      <span className="note">
        saved: {saved ? saved.map((s) => Math.round(s)).join(" / ") : "drag or use the keys"}
      </span>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "Two panels and a handle; arrows move it, Home and End go to the limits.",
  },
  Vertical: { title: "Vertical", description: '`orientation="vertical"` stacks the panels.' },
  ThreePanels: {
    title: "Three panels",
    description: "One handle per boundary; each moves only its neighbours until they reach `min`.",
  },
  Collapsible: {
    title: "Collapsible",
    description: "Enter collapses and restores; the button is the alternative to dragging.",
  },
  PixelMinimum: {
    title: "Pixel limits",
    description: '`"160px"` constraints are re-resolved whenever the Splitter resizes.',
  },
  Nested: { title: "Nested", description: "A Splitter inside a panel is independent." },
  Rtl: { title: "Right to left", description: '`dir="rtl"`: the first panel is on the right.' },
  DisabledHandle: {
    title: "Disabled handle",
    description: "`Handle disabled` leaves the tab order and ignores presses.",
  },
  SaveLayout: {
    title: "Save the layout",
    description: "`onSizesCommit` runs once per drag or key: the place to persist sizes.",
  },
}
