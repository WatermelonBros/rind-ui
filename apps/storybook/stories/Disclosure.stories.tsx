import type { Meta, StoryObj } from "@storybook/react-vite"
// The foundation fixture: not a public component (Collapsible gets its own change).
import { DisclosureExample } from "../../../packages/testing/fixtures/disclosure/disclosure.fixture"

const meta = {
  title: "Foundations/Disclosure fixture",
  component: DisclosureExample,
  args: { closeOnEscape: true },
  excludeStories: ["states"],
} satisfies Meta<typeof DisclosureExample>

/** State stories: contract scope → machine state → story export (ARIA snapshot per state). */
export const states = { disclosure: { closed: "Closed", open: "Open" } }

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }
export const EscapeDisabled: Story = { args: { closeOnEscape: false } }
