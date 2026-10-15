import type { Meta, StoryObj } from "@storybook/react-vite"
// The add-a11y-foundations press fixture: not public components (Button and Toggle get their
// own changes).
import { CounterButton, ToggleButton } from "../../../packages/testing/fixtures/press/press.react"

const meta = {
  title: "Foundations/Press fixture",
  component: ToggleButton,
  excludeStories: ["states"],
} satisfies Meta<typeof ToggleButton>

/** State stories: contract scope → machine state → story export (ARIA snapshot per state). */
export const states = {
  toggle: { off: "ToggleOff", on: "ToggleOn" },
  counter: { idle: "Counter" },
}

export default meta
type Story = StoryObj<typeof meta>

export const ToggleOff: Story = { args: { children: "Bold" } }
export const ToggleOn: Story = { args: { children: "Bold", defaultPressed: true } }
export const ToggleDisabled: Story = { args: { children: "Bold", disabled: true } }
export const Counter: Story = { render: () => <CounterButton>Add</CounterButton> }
