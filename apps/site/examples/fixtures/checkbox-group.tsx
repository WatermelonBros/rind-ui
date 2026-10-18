"use client"

// Ported from apps/storybook/stories/CheckboxGroup.stories.tsx
import { CheckboxGroup } from "@rind-ui/react"
import { type ComponentProps, useState } from "react"
import type { States, Variants } from "../types"

/**
 * State examples: contract scope → state → example export (ARIA snapshot per state). The group has
 * one contract state; the Parent's three states have their own examples below.
 */
export const states: States = {
  "checkbox-group": { ready: "Default" },
  checkbox: {
    unchecked: "AloneDefault",
    checked: "AloneChecked",
    indeterminate: "AloneIndeterminateStory",
  },
}

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const
const all = ["ham", "cheese", "olives"] as const
const names: Record<string, string> = { ham: "Ham", cheese: "Cheese", olives: "Olives" }

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

function Item({ value, disabled }: { value: string; disabled?: boolean }) {
  return (
    <CheckboxGroup.Item value={value} {...(disabled ? { disabled } : {})}>
      <CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemIndicator>{glyph}</CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>{names[value]}</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Item>
  )
}

function SelectAll({ label = "All toppings" }: { label?: string }) {
  return (
    <CheckboxGroup.Parent>
      <CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemIndicator>{glyph}</CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>{label}</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Parent>
  )
}

/** Label + items (+ optional Parent, Description, ErrorMessage) in a group. */
function Toppings({
  parent,
  items = all,
  disabledItem,
  description,
  error,
  ...root
}: {
  parent?: boolean
  items?: readonly string[]
  disabledItem?: string
  description?: string
  error?: string
} & Omit<ComponentProps<typeof CheckboxGroup.Root>, "children">) {
  return (
    <CheckboxGroup.Root {...(parent ? { allValues: all } : {})} {...root}>
      <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
      {description && <CheckboxGroup.Description>{description}</CheckboxGroup.Description>}
      {parent && <SelectAll />}
      {items.map((v) => (
        <Item key={v} value={v} {...(v === disabledItem ? { disabled: true } : {})} />
      ))}
      {error && <CheckboxGroup.ErrorMessage>{error}</CheckboxGroup.ErrorMessage>}
    </CheckboxGroup.Root>
  )
}

export function Default() {
  return <Toppings defaultValue={["cheese"]} />
}

export function WithParent() {
  return <Toppings parent defaultValue={["ham"]} />
}

export function ParentUnchecked() {
  return <Toppings parent />
}

export function ParentMixed() {
  return <Toppings parent defaultValue={["ham"]} />
}

export function ParentChecked() {
  return <Toppings parent defaultValue={[...all]} />
}

export function DisabledItem() {
  return <Toppings parent defaultValue={["ham"]} disabledItem="cheese" />
}

export function DisabledGroup() {
  return <Toppings parent disabled defaultValue={["ham"]} />
}

export function ReadOnly() {
  return <Toppings readOnly defaultValue={["ham", "cheese"]} />
}

export function RequiredWithError() {
  return (
    <Toppings
      required
      invalid
      description="Pick at least one."
      error="Choose at least one topping."
    />
  )
}

export function ControlledStory() {
  const [value, setValue] = useState<readonly string[]>(["ham"])
  return (
    <div style={column}>
      <Toppings parent value={value} onValueChange={setValue} />
      <p>{JSON.stringify(value)}</p>
      <button type="button" onClick={() => setValue([...all])}>
        Select all from outside
      </button>
    </div>
  )
}

export function InFormWithReset() {
  const [data, setData] = useState("(nothing submitted)")
  return (
    <form
      aria-label="Order"
      style={column}
      onSubmit={(e) => {
        e.preventDefault()
        setData(JSON.stringify(new FormData(e.currentTarget).getAll("topping")))
      }}
    >
      <Toppings parent name="topping" required defaultValue={["cheese"]} />
      <div style={{ display: "flex", gap: "var(--rind-space-2)" }}>
        <button type="submit">Submit</button>
        <button type="reset">Reset</button>
      </div>
      <output>{data}</output>
    </form>
  )
}

export function Fieldset() {
  return (
    <CheckboxGroup.Root render={<fieldset />} defaultValue={["ham"]}>
      <CheckboxGroup.Label render={<legend />}>Toppings</CheckboxGroup.Label>
      {all.map((v) => (
        <Item key={v} value={v} />
      ))}
    </CheckboxGroup.Root>
  )
}

/** The driver toggles items and the Parent the way a user would. */
export function DriverExample() {
  return <Toppings parent />
}

/** Control + Indicator + Label, the usual composition. */
function Box({
  label,
  description,
  ...root
}: { label: string; description?: string } & Omit<
  ComponentProps<typeof CheckboxGroup.Item>,
  "children"
>) {
  return (
    <CheckboxGroup.Item {...root}>
      <CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemIndicator>{glyph}</CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>{label}</CheckboxGroup.ItemLabel>
      {description && <CheckboxGroup.ItemDescription>{description}</CheckboxGroup.ItemDescription>}
    </CheckboxGroup.Item>
  )
}

export function AloneDefault() {
  return <Box label="Accept the terms" />
}

export function AloneChecked() {
  return <Box label="Accept the terms" defaultChecked />
}

export function AloneWithDescriptionStory() {
  return <Box label="Email me" description="At most one message a week." defaultChecked />
}

export function AloneIndeterminateStory() {
  return <Box label="Select all" defaultChecked="indeterminate" />
}

export function AloneDisabledStory() {
  return (
    <div style={column}>
      <Box label="Disabled unchecked" disabled />
      <Box label="Disabled checked" disabled defaultChecked />
    </div>
  )
}

export function AloneFocusableDisabled() {
  return <Box label="Focusable when disabled" disabled focusableWhenDisabled />
}

export function AloneReadOnly() {
  return <Box label="Read only" readOnly defaultChecked />
}

export function AloneRequiredInvalid() {
  return (
    <Box label="Accept the terms" description="You must accept to continue." required invalid />
  )
}

export function AloneInFormStory() {
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

export function AloneControlledStory() {
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
export function AloneWrappedInLabel() {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the CheckboxGroup.ItemControl inside
    <label>
      <CheckboxGroup.Item>
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>{glyph}</CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
      </CheckboxGroup.Item>{" "}
      Wrapped in a label
    </label>
  )
}

/** A non-labelable Control: the Label names it with aria-labelledby and toggles it once. */
export function AloneRenderAsDiv() {
  return (
    <CheckboxGroup.Item>
      <CheckboxGroup.ItemControl render={<div />}>
        <CheckboxGroup.ItemIndicator>{glyph}</CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>Rendered as a div</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Item>
  )
}

const options = Array.from({ length: 10 }, (_, i) => `Option ${i + 1}`)

export function AloneInScrollableContainer() {
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
export function AloneDriverExample() {
  return <Box label="Driven" />
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  WithParent: { title: "With parent", hidden: true },
  ParentUnchecked: { title: "Parent unchecked", hidden: true },
  ParentMixed: { title: "Parent mixed", hidden: true },
  ParentChecked: { title: "Parent checked", hidden: true },
  DisabledItem: { title: "Disabled item", hidden: true },
  DisabledGroup: { title: "Disabled group", hidden: true },
  ReadOnly: { title: "Read only", hidden: true },
  RequiredWithError: { title: "Required with error", hidden: true },
  ControlledStory: { title: "Controlled", hidden: true },
  InFormWithReset: { title: "In form with reset", hidden: true },
  Fieldset: { title: "Fieldset", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
  AloneDefault: { title: "Default", hidden: true },
  AloneChecked: { title: "Checked", hidden: true },
  AloneWithDescriptionStory: { title: "With description", hidden: true },
  AloneIndeterminateStory: { title: "Indeterminate", hidden: true },
  AloneDisabledStory: { title: "Disabled", hidden: true },
  AloneFocusableDisabled: { title: "Focusable disabled", hidden: true },
  AloneReadOnly: { title: "Read only", hidden: true },
  AloneRequiredInvalid: { title: "Required invalid", hidden: true },
  AloneInFormStory: { title: "In form", hidden: true },
  AloneControlledStory: { title: "Controlled", hidden: true },
  AloneWrappedInLabel: { title: "Wrapped in label", hidden: true },
  AloneRenderAsDiv: { title: "Render as div", hidden: true },
  AloneInScrollableContainer: { title: "In scrollable container", hidden: true },
  AloneDriverExample: { title: "Driver example", hidden: true },
}
