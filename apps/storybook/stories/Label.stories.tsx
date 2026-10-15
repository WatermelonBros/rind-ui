import { domEnvironment } from "@rind-ui/core"
import { Label, Link } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { getLabel } from "../../../packages/testing/src/components/label"

const meta = {
  title: "Components/Label",
  component: Label,
  excludeStories: ["states"],
} satisfies Meta<typeof Label>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  label: { default: "ForInput" },
}

export default meta
type Story = StoryObj<typeof meta>

const column = { display: "grid", gap: "var(--rind-space-2)", maxWidth: "24rem" } as const

/** `htmlFor` names a separate input. */
export const ForInput: Story = {
  render: () => (
    <div style={column}>
      <Label htmlFor="email">Email</Label>
      <input id="email" type="email" />
    </div>
  ),
}

/** The control sits inside the label: no `for` needed. */
export const WrappingInput: Story = {
  render: () => (
    <Label>
      Full name <input type="text" />
    </Label>
  ),
}

/** Pressing the link follows it; it does not toggle the checkbox (native behaviour). */
export const WrappingCheckboxWithLink: Story = {
  render: () => (
    <Label>
      <input type="checkbox" /> I accept the <Link href="#terms">terms</Link>
    </Label>
  ),
}

/**
 * A native `<select>` shows what a label does to a popup trigger: focus, no opening. A rind
 * Button as a popup trigger is not available yet.
 */
export const ForPopupTrigger: Story = {
  render: () => (
    <div style={column}>
      <Label htmlFor="fruit">Fruit</Label>
      <select id="fruit">
        <option>Apple</option>
        <option>Pear</option>
      </select>
      <p>Note: pressing the label focuses the select and does not open it.</p>
    </div>
  ),
}

/** A div cannot be labelled by `for`: the Label warns in development and focuses it. */
export const NonLabelableTarget: Story = {
  render: () => (
    <div style={column}>
      <Label id="size-label" htmlFor="size">
        Size
      </Label>
      <div id="size" role="radiogroup" tabIndex={0} aria-labelledby="size-label">
        <label>
          <input type="radio" name="size" /> Small
        </label>
        <label>
          <input type="radio" name="size" /> Large
        </label>
      </div>
      <p>Note: in development this logs a warning, because a div is not labelable.</p>
    </div>
  ),
}

/** Another tag: it forwards focus itself, and the control names itself with `aria-labelledby`. */
export const AsSpan: Story = {
  render: () => (
    <div style={column}>
      <Label id="city-label" htmlFor="city" render={<span />}>
        City
      </Label>
      <input id="city" aria-labelledby="city-label" />
    </div>
  ),
}

export const Danger: Story = {
  render: () => (
    <div style={column}>
      <Label htmlFor="pwd" data-tone="danger">
        Password
      </Label>
      <input id="pwd" type="password" aria-invalid="true" />
    </div>
  ),
}

/** The driver: a press on the label focuses its control. */
export const DriverExample: Story = {
  render: () => (
    <div style={column}>
      <Label htmlFor="drv">Email</Label>
      <input id="drv" type="email" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const label = getLabel(
      canvasElement,
      { text: "Email" },
      { platform: domEnvironment().platform },
    )
    await label.click()
    await expect(label.isControlFocused()).resolves.toBe(true)
  },
}
