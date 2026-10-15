import { Switch } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, useState } from "react"
import { expect } from "storybook/test"
import { getSwitch } from "../../../packages/testing/src/components/switch"

const meta = {
  title: "Components/Switch",
  component: Switch.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof Switch.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  switch: { unchecked: "Default", checked: "Checked" },
}

export default meta
type Story = StoryObj<typeof meta>

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const

/** Control + Thumb + Label (+ Description), the usual composition. */
function Toggle({
  label,
  description,
  ...root
}: { label: string; description?: string } & Omit<ComponentProps<typeof Switch.Root>, "children">) {
  return (
    <Switch.Root {...root}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Label>{label}</Switch.Label>
      {description && <Switch.Description>{description}</Switch.Description>}
    </Switch.Root>
  )
}

export const Default: Story = {
  render: () => <Toggle label="Wi-Fi" />,
}

export const Checked: Story = {
  render: () => <Toggle label="Wi-Fi" defaultChecked />,
}

export const Disabled: Story = {
  render: () => (
    <div style={column}>
      <Toggle label="Disabled off" disabled />
      <Toggle label="Disabled on" disabled defaultChecked />
    </div>
  ),
}

export const FocusableWhenDisabled: Story = {
  render: () => <Toggle label="Focusable when disabled" disabled focusableWhenDisabled />,
}

export const ReadOnly: Story = {
  render: () => <Toggle label="Read only" readOnly defaultChecked />,
}

export const WithDescription: Story = {
  render: () => (
    <Toggle
      label="Airplane mode"
      description="Turns off all wireless connections."
      defaultChecked
    />
  ),
}

export const InForm: Story = {
  render: () => {
    const [data, setData] = useState("(nothing submitted)")
    return (
      <form
        aria-label="Settings"
        style={column}
        onSubmit={(e) => {
          e.preventDefault()
          setData(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))))
        }}
      >
        <Toggle label="Notifications" name="notifications" value="yes" defaultChecked />
        <Toggle label="Sounds" name="sounds" uncheckedValue="no" />
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
    <div dir="rtl" style={column}>
      <Toggle label="Off" />
      <Toggle label="On" defaultChecked />
    </div>
  ),
}

/** The driver toggles it the way a user would: pointer, then Space, then the label. */
export const DriverExample: Story = {
  render: () => <Toggle label="Driven" />,
  play: async ({ canvasElement }) => {
    const sw = getSwitch(canvasElement, { name: "Driven" })
    await expect(sw.isChecked()).resolves.toBe(false)
    await sw.toggle()
    await expect(sw.isChecked()).resolves.toBe(true)
    await sw.via("keyboard").toggle()
    await expect(sw.isChecked()).resolves.toBe(false)
    await sw.clickLabel()
    await expect(sw.isChecked()).resolves.toBe(true)
  },
}
