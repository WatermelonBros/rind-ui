"use client"

// Ported from apps/storybook/stories/Tabs.stories.tsx
import { RindProvider, Tabs } from "@rind-ui/react"
import { type ComponentProps, useState } from "react"
import type { States, Variants } from "../types"

export const states: States = {
  tabs: { idle: "Default", focused: "Default" },
}

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "32rem" } as const
const sections = ["account", "billing", "team"] as const
const names: Record<string, string> = { account: "Account", billing: "Billing", team: "Team" }

/** A "Sections" tab list with three tabs and panels, then the "After" button (`leave`). */
function Sections({
  disabledTab,
  indicator,
  tabs = sections,
  listStyle,
  ...root
}: {
  disabledTab?: string
  indicator?: boolean
  tabs?: readonly string[]
  listStyle?: React.CSSProperties
} & Omit<ComponentProps<typeof Tabs.Root>, "children">) {
  return (
    <>
      <Tabs.Root {...root}>
        <Tabs.List aria-label="Sections" style={listStyle}>
          {tabs.map((v) => (
            <Tabs.Tab key={v} value={v} {...(v === disabledTab ? { disabled: true } : {})}>
              {names[v] ?? v}
            </Tabs.Tab>
          ))}
          {indicator ? <Tabs.Indicator /> : null}
        </Tabs.List>
        {tabs.map((v) => (
          <Tabs.Panel key={v} value={v}>
            <p>{names[v] ?? v} settings</p>
          </Tabs.Panel>
        ))}
      </Tabs.Root>
      <button type="button">After</button>
    </>
  )
}

export function Default() {
  return <Sections defaultValue="account" />
}

export function VerticalStory() {
  return <Sections orientation="vertical" defaultValue="account" />
}

/** Arrows move focus only; Enter or Space selects. */
export function ManualActivation() {
  return <Sections activationMode="manual" defaultValue="account" />
}

export function DisabledTabStory() {
  return <Sections disabledTab="billing" defaultValue="account" />
}

export function FocusableWhenDisabled() {
  return <Sections disabledTab="billing" focusableWhenDisabled defaultValue="account" />
}

/** Inactive panels stay in the DOM with `hidden`. */
export function InactivePanelsHidden() {
  return <Sections inactivePanels="hidden" defaultValue="account" />
}

/** Inactive panels are `hidden="until-found"`: find-in-page reveals one and selects its tab. */
export function InactivePanelsUntilFound() {
  return <Sections inactivePanels="until-found" defaultValue="account" />
}

export function WithIndicator() {
  return <Sections indicator defaultValue="account" />
}

export function ScrollableList() {
  return (
    <div style={{ maxWidth: "16rem" }}>
      <Sections
        indicator
        defaultValue="tab-1"
        tabs={Array.from({ length: 12 }, (_, i) => `tab-${i + 1}`)}
        listStyle={{ overflowX: "auto" }}
      />
    </div>
  )
}

export function RTL() {
  return (
    // The direction for the arrow keys comes from the provider, the layout from `dir`.
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Sections indicator defaultValue="billing" />
      </div>
    </RindProvider>
  )
}

export function ControlledStory() {
  const [value, setValue] = useState<string | null>("account")
  return (
    <div style={column}>
      <Sections value={value} onValueChange={setValue} />
      <p>{value ?? "(none)"}</p>
      <button type="button" onClick={() => setValue("team")}>
        Team from outside
      </button>
    </div>
  )
}

/** The driver selects tabs by pointer and keyboard the way a user would. */
export function DriverExample() {
  return <Sections activationMode="manual" defaultValue="account" />
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  VerticalStory: { title: "Vertical", hidden: true },
  ManualActivation: { title: "Manual activation", hidden: true },
  DisabledTabStory: { title: "Disabled tab", hidden: true },
  FocusableWhenDisabled: { title: "Focusable when disabled", hidden: true },
  InactivePanelsHidden: { title: "Inactive panels hidden", hidden: true },
  InactivePanelsUntilFound: { title: "Inactive panels until found", hidden: true },
  WithIndicator: { title: "With indicator", hidden: true },
  ScrollableList: { title: "Scrollable list", hidden: true },
  RTL: { title: "RTL", hidden: true },
  ControlledStory: { title: "Controlled", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
