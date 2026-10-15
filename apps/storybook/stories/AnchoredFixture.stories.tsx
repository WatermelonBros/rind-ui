import type { Meta, StoryObj } from "@storybook/react-vite"
// The positioning foundation fixture: not a public component (Popover, Menu... get their own).
import { AnchoredExample } from "../../../packages/testing/fixtures/anchored/anchored.react"

const meta = {
  title: "Foundations/Anchored fixture",
  component: AnchoredExample,
  excludeStories: ["states"],
} satisfies Meta<typeof AnchoredExample>

/** State stories: contract scope → machine state → story export. */
export const states = { anchored: { closed: "Closed", open: "Open" } }

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }

export const Popup: Story = { args: { defaultOpen: true, preset: "popup", label: "Popup" } }

export const Dropdown: Story = {
  args: { defaultOpen: true, preset: "dropdown", label: "Dropdown" },
}

export const Submenu: Story = {
  args: {
    defaultOpen: true,
    preset: "submenu",
    label: "Submenu",
    positioning: { side: "inline-end" },
  },
  render: (args) => (
    <div style={{ paddingInlineStart: "4rem" }}>
      <AnchoredExample {...args} />
    </div>
  ),
}

/** A point anchor at a fixed viewport position (a context menu at the pointer). */
export const Pointer: Story = {
  args: {
    defaultOpen: true,
    preset: "pointer",
    label: "Pointer",
    title: "At the pointer",
    anchor: { x: 200, y: 160 },
  },
}

const corner = (label: string, style: React.CSSProperties) => (
  <div style={{ position: "fixed", ...style }}>
    <AnchoredExample defaultOpen label={label} title={label} />
  </div>
)

/** Anchors in the four corners: every popup flips or shifts to stay in view. */
export const Edges: Story = {
  render: () => (
    <>
      {corner("Top start", { top: 8, insetInlineStart: 8 })}
      {corner("Top end", { top: 8, insetInlineEnd: 8 })}
      {corner("Bottom start", { bottom: 8, insetInlineStart: 8 })}
      {corner("Bottom end", { bottom: 8, insetInlineEnd: 8 })}
    </>
  ),
}

export const RTL: Story = {
  args: { defaultOpen: true, preset: "submenu", positioning: { side: "inline-end" } },
  render: (args) => (
    <div dir="rtl" lang="ar" style={{ paddingInlineStart: "4rem" }}>
      <AnchoredExample {...args} />
    </div>
  ),
}

/** A 320 px wide frame: the content is capped at the available width and scrolls. */
export const Narrow320: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <div style={{ width: 320, overflow: "hidden", border: "1px dashed currentcolor" }}>
      <AnchoredExample {...args}>
        <p style={{ width: 600 }}>Wide content that does not fit in 320 px and scrolls.</p>
      </AnchoredExample>
    </div>
  ),
  parameters: { viewport: { defaultViewport: "mobile1" } },
}

export const WithArrow: Story = { args: { defaultOpen: true, arrow: true, label: "Arrow" } }

/** Mode "manual": no coordinates written; the consumer places it with CSS anchor positioning. */
export const ManualMode: Story = {
  args: { defaultOpen: true, positioning: { mode: "manual" }, label: "Manual" },
  render: (args) => (
    <>
      <style>{`
        [data-scope="anchored"][data-part="positioner"] {
          position: fixed;
          position-area: bottom;
        }
      `}</style>
      <AnchoredExample {...args} />
    </>
  ),
}

/** The positioner stays mounted (hidden) while closed, so reopening does not flash. */
export const KeepMounted: Story = { args: { keepMounted: true, label: "Keep mounted" } }
