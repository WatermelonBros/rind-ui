import { RindProvider, Tabs } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, useState } from "react"
import { expect } from "storybook/test"
import { getTabs } from "../../../packages/testing/src/components/tabs"

const meta = {
  title: "Components/Tabs",
  component: Tabs.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof Tabs.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  tabs: { idle: "Default", focused: "Default" },
}

export default meta
type Story = StoryObj<typeof meta>

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

export const Default: Story = {
  render: () => <Sections defaultValue="account" />,
}

export const Vertical: Story = {
  render: () => <Sections orientation="vertical" defaultValue="account" />,
}

/** Arrows move focus only; Enter or Space selects. */
export const ManualActivation: Story = {
  render: () => <Sections activationMode="manual" defaultValue="account" />,
}

export const DisabledTab: Story = {
  render: () => <Sections disabledTab="billing" defaultValue="account" />,
}

export const FocusableWhenDisabled: Story = {
  render: () => <Sections disabledTab="billing" focusableWhenDisabled defaultValue="account" />,
}

/** Inactive panels stay in the DOM with `hidden`. */
export const InactivePanelsHidden: Story = {
  render: () => <Sections inactivePanels="hidden" defaultValue="account" />,
}

/** Inactive panels are `hidden="until-found"`: find-in-page reveals one and selects its tab. */
export const InactivePanelsUntilFound: Story = {
  render: () => <Sections inactivePanels="until-found" defaultValue="account" />,
}

export const WithIndicator: Story = {
  render: () => <Sections indicator defaultValue="account" />,
}

export const ScrollableList: Story = {
  render: () => (
    <div style={{ maxWidth: "16rem" }}>
      <Sections
        indicator
        defaultValue="tab-1"
        tabs={Array.from({ length: 12 }, (_, i) => `tab-${i + 1}`)}
        listStyle={{ overflowX: "auto" }}
      />
    </div>
  ),
}

export const RTL: Story = {
  render: () => (
    // The direction for the arrow keys comes from the provider, the layout from `dir`.
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Sections indicator defaultValue="billing" />
      </div>
    </RindProvider>
  ),
}

export const Controlled: Story = {
  render: () => {
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
  },
}

/** The driver selects tabs by pointer and keyboard the way a user would. */
export const DriverExample: Story = {
  render: () => <Sections activationMode="manual" defaultValue="account" />,
  play: async ({ canvasElement }) => {
    const tabs = getTabs(canvasElement, { name: "Sections" })
    await expect(tabs.tabs()).resolves.toEqual(["Account", "Billing", "Team"])
    await expect(tabs.selected()).resolves.toBe("Account")
    await tabs.select("Billing")
    await expect(tabs.selected()).resolves.toBe("Billing")
    await expect(tabs.panel()).resolves.toMatchObject({ text: "Billing settings" })
    await tabs.focusTab("Team")
    await expect(tabs.selected()).resolves.toBe("Billing") // focus alone never selects
    await tabs.via("keyboard").select("Team")
    await expect(tabs.selected()).resolves.toBe("Team")
  },
}
