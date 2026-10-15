import { RindProvider, SegmentedControl } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, useState } from "react"
import { expect } from "storybook/test"
import { getSegmentedControl } from "../../../packages/testing/src/components/segmented-control"

const meta = {
  title: "Components/SegmentedControl",
  component: SegmentedControl.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof SegmentedControl.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  "segmented-control": { idle: "Default", focused: "Default" },
}

export default meta
type Story = StoryObj<typeof meta>

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

export const Default: Story = {
  render: () => <Range defaultValue="day" />,
}

export const WithIndicator: Story = {
  render: () => <Range indicator defaultValue="week" />,
}

/** The label is a child of the root; the theme draws it above the pill. */
export const WithLabel: Story = {
  render: () => (
    <div style={{ paddingBlockStart: "var(--rind-space-8)" }}>
      <Range indicator label="Range" defaultValue="week" />
    </div>
  ),
}

export const Vertical: Story = {
  render: () => <Range indicator orientation="vertical" defaultValue="day" />,
}

/** An icon-only segment is named by its `aria-label`. */
export const IconSegments: Story = {
  render: () => (
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
  ),
}

export const DisabledSegment: Story = {
  render: () => <Range indicator disabledSegment="week" defaultValue="day" />,
}

export const ReadOnly: Story = {
  render: () => <Range indicator readOnly defaultValue="week" />,
}

export const InForm: Story = {
  render: () => {
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
  },
}

export const RTL: Story = {
  render: () => (
    // The direction for the arrow keys comes from the provider, the layout from `dir`.
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Range indicator defaultValue="week" />
      </div>
    </RindProvider>
  ),
}

export const Controlled: Story = {
  render: () => {
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
  },
}

/** The control mounts after the page: the indicator still measures the selected segment. */
export const ConditionalMount: Story = {
  render: () => {
    const [shown, setShown] = useState(false)
    return (
      <div style={column}>
        <button type="button" onClick={() => setShown((s) => !s)}>
          Toggle control
        </button>
        {shown ? <Range indicator defaultValue="week" /> : null}
      </div>
    )
  },
}

/** The driver selects segments by pointer and keyboard the way a user would. */
export const DriverExample: Story = {
  render: () => <Range indicator name="range" />,
  play: async ({ canvasElement }) => {
    const control = getSegmentedControl(canvasElement, { name: "Range" })
    await expect(control.segments()).resolves.toEqual(["Day", "Week", "Month"])
    await control.select("Week")
    await expect(control.selected()).resolves.toBe("Week")
    await expect(control.formValue()).resolves.toEqual([["range", "week"]])
    await control.via("keyboard").select("Month")
    await expect(control.selected()).resolves.toBe("Month")
    await control.focusSegment("Day")
    await expect(control.selected()).resolves.toBe("Month") // focus alone never selects
  },
}
