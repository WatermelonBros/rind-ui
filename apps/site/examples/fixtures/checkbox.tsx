"use client"

// Ported from apps/storybook/stories/Checkbox.stories.tsx
import { Checkbox } from "@rind-ui/react"
import { type ComponentProps, useState } from "react"
import type { States, Variants } from "../types"

/** State examples: contract scope → state → example export (ARIA snapshot per state). */
export const states: States = {
  checkbox: { unchecked: "Default", checked: "Checked", indeterminate: "IndeterminateStory" },
}

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

export function Default() {
  return <Box label="Accept the terms" />
}

export function Checked() {
  return <Box label="Accept the terms" defaultChecked />
}

export function WithDescriptionStory() {
  return <Box label="Email me" description="At most one message a week." defaultChecked />
}

export function IndeterminateStory() {
  return <Box label="Select all" defaultChecked="indeterminate" />
}

export function DisabledStory() {
  return (
    <div style={column}>
      <Box label="Disabled unchecked" disabled />
      <Box label="Disabled checked" disabled defaultChecked />
    </div>
  )
}

export function FocusableDisabled() {
  return <Box label="Focusable when disabled" disabled focusableWhenDisabled />
}

export function ReadOnly() {
  return <Box label="Read only" readOnly defaultChecked />
}

export function RequiredInvalid() {
  return (
    <Box label="Accept the terms" description="You must accept to continue." required invalid />
  )
}

export function InFormStory() {
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
}

export function ControlledStory() {
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
}

/** The consumer's own label wraps the Root; the Control is still the one named control. */
export function WrappedInLabel() {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the Checkbox.Control inside
    <label>
      <Checkbox.Root>
        <Checkbox.Control>
          <Checkbox.Indicator>{glyph}</Checkbox.Indicator>
        </Checkbox.Control>
      </Checkbox.Root>{" "}
      Wrapped in a label
    </label>
  )
}

/** A non-labelable Control: the Label names it with aria-labelledby and toggles it once. */
export function RenderAsDiv() {
  return (
    <Checkbox.Root>
      <Checkbox.Control render={<div />}>
        <Checkbox.Indicator>{glyph}</Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label>Rendered as a div</Checkbox.Label>
    </Checkbox.Root>
  )
}

const options = Array.from({ length: 10 }, (_, i) => `Option ${i + 1}`)

export function InScrollableContainer() {
  return (
    // The checkboxes inside are focusable, so the scroller is keyboard reachable.
    <section
      style={{ ...column, height: "8rem", overflow: "auto", border: "1px solid currentColor" }}
      aria-label="Options"
    >
      {options.map((label) => (
        <Box key={label} label={label} />
      ))}
    </section>
  )
}

/** The driver toggles it the way a user would: pointer, then Space, then the label. */
export function DriverExample() {
  return <Box label="Driven" />
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  Checked: { title: "Checked", hidden: true },
  WithDescriptionStory: { title: "With description", hidden: true },
  IndeterminateStory: { title: "Indeterminate", hidden: true },
  DisabledStory: { title: "Disabled", hidden: true },
  FocusableDisabled: { title: "Focusable disabled", hidden: true },
  ReadOnly: { title: "Read only", hidden: true },
  RequiredInvalid: { title: "Required invalid", hidden: true },
  InFormStory: { title: "In form", hidden: true },
  ControlledStory: { title: "Controlled", hidden: true },
  WrappedInLabel: { title: "Wrapped in label", hidden: true },
  RenderAsDiv: { title: "Render as div", hidden: true },
  InScrollableContainer: { title: "In scrollable container", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
