import { Checkbox } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, useState } from "react"
import { expect } from "storybook/test"
import { getCheckbox } from "../../../packages/testing/src/components/checkbox"

const meta = {
  title: "Components/Checkbox",
  component: Checkbox.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof Checkbox.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  checkbox: { unchecked: "Default", checked: "Checked", indeterminate: "Indeterminate" },
}

export default meta
type Story = StoryObj<typeof meta>

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const

/** A check and a dash, both drawn with currentColor; they differ in shape, not only colour. */
const glyph = ({ indeterminate }: { checked: boolean; indeterminate: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d={indeterminate ? "M3 7h8" : "M3 7.5l2.8 2.8L11 4"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/** Control + Indicator + Label, the usual composition. */
function Box({
  label,
  description,
  ...root
}: { label: string; description?: string } & Omit<
  ComponentProps<typeof Checkbox.Root>,
  "children"
>) {
  return (
    <Checkbox.Root {...root}>
      <Checkbox.Control>
        <Checkbox.Indicator>{glyph}</Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label>{label}</Checkbox.Label>
      {description && <Checkbox.Description>{description}</Checkbox.Description>}
    </Checkbox.Root>
  )
}

export const Default: Story = {
  render: () => <Box label="Accept the terms" />,
}

export const Checked: Story = {
  render: () => <Box label="Accept the terms" defaultChecked />,
}

export const WithDescription: Story = {
  render: () => <Box label="Email me" description="At most one message a week." defaultChecked />,
}

export const Indeterminate: Story = {
  render: () => <Box label="Select all" defaultChecked="indeterminate" />,
}

export const Disabled: Story = {
  render: () => (
    <div style={column}>
      <Box label="Disabled unchecked" disabled />
      <Box label="Disabled checked" disabled defaultChecked />
    </div>
  ),
}

export const FocusableDisabled: Story = {
  render: () => <Box label="Focusable when disabled" disabled focusableWhenDisabled />,
}

export const ReadOnly: Story = {
  render: () => <Box label="Read only" readOnly defaultChecked />,
}

export const RequiredInvalid: Story = {
  render: () => (
    <Box label="Accept the terms" description="You must accept to continue." required invalid />
  ),
}

export const InForm: Story = {
  render: () => {
    const [data, setData] = useState("(nothing submitted)")
    return (
      <form
        aria-label="Preferences"
        style={column}
        onSubmit={(e) => {
          e.preventDefault()
          setData(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))))
        }}
      >
        <Box label="Newsletter" name="newsletter" value="yes" defaultChecked />
        <Box label="Updates" name="updates" uncheckedValue="no" />
        <div style={{ display: "flex", gap: "var(--rind-space-2)" }}>
          <button type="submit">Submit</button>
          <button type="reset">Reset</button>
        </div>
        <output>{data}</output>
      </form>
    )
  },
}

export const Controlled: Story = {
  render: () => {
    const [checked, setChecked] = useState<boolean | "indeterminate">("indeterminate")
    return (
      <div style={column}>
        <Box label="Controlled" checked={checked} onCheckedChange={setChecked} />
        <p>{String(checked)}</p>
        <button type="button" onClick={() => setChecked(true)}>
          Check from outside
        </button>
      </div>
    )
  },
}

/** The consumer's own label wraps the Root; the Control is still the one named control. */
export const WrappedInLabel: Story = {
  render: () => (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the Checkbox.Control inside
    <label>
      <Checkbox.Root>
        <Checkbox.Control>
          <Checkbox.Indicator>{glyph}</Checkbox.Indicator>
        </Checkbox.Control>
      </Checkbox.Root>{" "}
      Wrapped in a label
    </label>
  ),
}

/** A non-labelable Control: the Label names it with aria-labelledby and toggles it once. */
export const RenderAsDiv: Story = {
  render: () => (
    <Checkbox.Root>
      <Checkbox.Control render={<div />}>
        <Checkbox.Indicator>{glyph}</Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label>Rendered as a div</Checkbox.Label>
    </Checkbox.Root>
  ),
}

const options = Array.from({ length: 10 }, (_, i) => `Option ${i + 1}`)

export const InScrollableContainer: Story = {
  render: () => (
    // The checkboxes inside are focusable, so the scroller is keyboard reachable.
    <section
      style={{ ...column, height: "8rem", overflow: "auto", border: "1px solid currentColor" }}
      aria-label="Options"
    >
      {options.map((label) => (
        <Box key={label} label={label} />
      ))}
    </section>
  ),
}

/** The driver toggles it the way a user would: pointer, then Space, then the label. */
export const DriverExample: Story = {
  render: () => <Box label="Driven" />,
  play: async ({ canvasElement }) => {
    const box = getCheckbox(canvasElement, { name: "Driven" })
    await expect(box.isChecked()).resolves.toBe(false)
    await box.check()
    await expect(box.isChecked()).resolves.toBe(true)
    await box.via("keyboard").uncheck()
    await expect(box.isChecked()).resolves.toBe(false)
    await box.clickLabel()
    await expect(box.isChecked()).resolves.toBe(true)
  },
}
