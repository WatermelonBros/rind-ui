import { Toggle } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect } from "storybook/test"
import { getToggle } from "../../../packages/testing/src/components/toggle"

const meta = {
  title: "Components/Toggle",
  component: Toggle.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof Toggle.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = { toggle: { off: "Default", on: "On" } }

export default meta
type Story = StoryObj<typeof meta>

const row = {
  display: "flex",
  gap: "var(--rind-space-3)",
  alignItems: "center",
  flexWrap: "wrap",
} as const

export const Default: Story = {
  render: () => <Toggle.Root>Bold</Toggle.Root>,
}

export const On: Story = {
  render: () => <Toggle.Root defaultPressed>Bold</Toggle.Root>,
}

export const Disabled: Story = {
  render: () => (
    <div style={row}>
      <Toggle.Root disabled>Off</Toggle.Root>
      <Toggle.Root disabled defaultPressed>
        On
      </Toggle.Root>
    </div>
  ),
}

export const FocusableWhenDisabled: Story = {
  render: () => (
    <Toggle.Root disabled focusableWhenDisabled>
      Italic
    </Toggle.Root>
  ),
}

/** The name stays "Mute"; only the icon (aria-hidden) and aria-pressed follow the state. */
export const IconOnly: Story = {
  render: () => (
    <Toggle.Root aria-label="Mute">
      <Toggle.Indicator fallback="🔊">🔇</Toggle.Indicator>
    </Toggle.Root>
  ),
}

export const Controlled: Story = {
  render: () => {
    const [pressed, setPressed] = useState(false)
    return (
      <div style={row}>
        <Toggle.Root pressed={pressed} onPressedChange={setPressed}>
          Bold
        </Toggle.Root>
        <p>{pressed ? "On" : "Off"}</p>
        <button type="button" onClick={() => setPressed((p) => !p)}>
          Toggle from outside
        </button>
      </div>
    )
  },
}

/** The driver presses it the way a user would: pointer, then Space, then Enter. */
export const DriverExample: Story = {
  render: () => <Toggle.Root>Driven</Toggle.Root>,
  play: async ({ canvasElement }) => {
    const toggle = getToggle(canvasElement, { name: "Driven" })
    await expect(toggle.isPressed()).resolves.toBe(false)
    await toggle.setPressed(true)
    await expect(toggle.isPressed()).resolves.toBe(true)
    await toggle.via("keyboard").setPressed(false)
    await expect(toggle.isPressed()).resolves.toBe(false)
    await toggle.via("keyboard").activateWithEnter(true)
    await expect(toggle.isPressed()).resolves.toBe(true)
  },
}
