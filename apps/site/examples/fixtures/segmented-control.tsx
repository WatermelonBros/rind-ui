"use client"

// Ported from apps/storybook/stories/SegmentedControl.stories.tsx
import { RindProvider, SegmentedControl } from "@rind-ui/react"
import { type ComponentProps, useState } from "react"
import type { States, Variants } from "../types"

export const states: States = {
  "segmented-control": { idle: "Default", focused: "Default" },
}

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "32rem" } as const
const ranges = ["day", "week", "month"] as const
const names: Record<string, string> = { day: "Day", week: "Week", month: "Month" }

/** A "Range" segmented control with three segments, then the "After" button (`leave`). */
function Range({
  disabledSegment,
  indicator,
  label,
  ...root
}: {
  disabledSegment?: string
  indicator?: boolean
  label?: string
} & Omit<ComponentProps<typeof SegmentedControl.Root>, "children">) {
  return (
    <>
      <SegmentedControl.Root {...(label ? {} : { "aria-label": "Range" })} {...root}>
        {label ? <SegmentedControl.Label>{label}</SegmentedControl.Label> : null}
        {ranges.map((v) => (
          <SegmentedControl.Item
            key={v}
            value={v}
            {...(v === disabledSegment ? { disabled: true } : {})}
          >
            {names[v]}
          </SegmentedControl.Item>
        ))}
        {indicator ? <SegmentedControl.Indicator /> : null}
      </SegmentedControl.Root>
      <button type="button">After</button>
    </>
  )
}

export function Default() {
  return <Range defaultValue="day" />
}

export function WithIndicator() {
  return <Range indicator defaultValue="week" />
}

/** The label is a child of the root; the theme draws it above the pill. */
export function WithLabelStory() {
  return (
    <div style={{ paddingBlockStart: "var(--rind-space-8)" }}>
      <Range indicator label="Range" defaultValue="week" />
    </div>
  )
}

export function Vertical() {
  return <Range indicator orientation="vertical" defaultValue="day" />
}

/** An icon-only segment is named by its `aria-label`. */
export function IconSegments() {
  return (
    <>
      <SegmentedControl.Root aria-label="View" defaultValue="list">
        <SegmentedControl.Item value="list" aria-label="List">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="3" width="12" height="2" />
            <rect x="2" y="7" width="12" height="2" />
            <rect x="2" y="11" width="12" height="2" />
          </svg>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="grid" aria-label="Grid">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="2" width="5" height="5" />
            <rect x="9" y="2" width="5" height="5" />
            <rect x="2" y="9" width="5" height="5" />
            <rect x="9" y="9" width="5" height="5" />
          </svg>
        </SegmentedControl.Item>
        <SegmentedControl.Indicator />
      </SegmentedControl.Root>
      <button type="button">After</button>
    </>
  )
}

export function DisabledSegment() {
  return <Range indicator disabledSegment="week" defaultValue="day" />
}

export function ReadOnly() {
  return <Range indicator readOnly defaultValue="week" />
}

export function InFormStory() {
  const [data, setData] = useState("(nothing submitted)")
  return (
    <form
      aria-label="Report"
      style={column}
      onSubmit={(e) => {
        e.preventDefault()
        setData(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))))
      }}
    >
      <Range indicator name="range" required defaultValue="day" />
      <div style={{ display: "flex", gap: "var(--rind-space-2)" }}>
        <button type="submit">Submit</button>
        <button type="reset">Reset</button>
      </div>
      <output>{data}</output>
    </form>
  )
}

export function RTL() {
  return (
    // The direction for the arrow keys comes from the provider, the layout from `dir`.
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Range indicator defaultValue="week" />
      </div>
    </RindProvider>
  )
}

export function ControlledStory() {
  const [value, setValue] = useState<string | null>("day")
  return (
    <div style={column}>
      <Range indicator value={value} onValueChange={setValue} />
      <p>{value ?? "(none)"}</p>
      <button type="button" onClick={() => setValue("month")}>
        Month from outside
      </button>
    </div>
  )
}

/** The control mounts after the page: the indicator still measures the selected segment. */
export function ConditionalMount() {
  const [shown, setShown] = useState(false)
  return (
    <div style={column}>
      <button type="button" onClick={() => setShown((s) => !s)}>
        Toggle control
      </button>
      {shown ? <Range indicator defaultValue="week" /> : null}
    </div>
  )
}

/** The driver selects segments by pointer and keyboard the way a user would. */
export function DriverExample() {
  return <Range indicator name="range" />
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  WithIndicator: { title: "With indicator", hidden: true },
  WithLabelStory: { title: "With label", hidden: true },
  Vertical: { title: "Vertical", hidden: true },
  IconSegments: { title: "Icon segments", hidden: true },
  DisabledSegment: { title: "Disabled segment", hidden: true },
  ReadOnly: { title: "Read only", hidden: true },
  InFormStory: { title: "In form", hidden: true },
  RTL: { title: "RTL", hidden: true },
  ControlledStory: { title: "Controlled", hidden: true },
  ConditionalMount: { title: "Conditional mount", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
