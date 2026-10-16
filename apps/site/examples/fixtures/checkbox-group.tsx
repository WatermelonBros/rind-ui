"use client"

// Ported from apps/storybook/stories/CheckboxGroup.stories.tsx
import { Checkbox, CheckboxGroup } from "@rind-ui/react"
import { type ComponentProps, useState } from "react"
import type { States, Variants } from "../types"

/**
 * State examples: contract scope → state → example export (ARIA snapshot per state). The group has
 * one contract state; the Parent's three states have their own examples below.
 */
export const states: States = {
  "checkbox-group": { ready: "Default" },
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
    <Checkbox.Root value={value} {...(disabled ? { disabled } : {})}>
      <Checkbox.Control>
        <Checkbox.Indicator>{glyph}</Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label>{names[value]}</Checkbox.Label>
    </Checkbox.Root>
  )
}

function SelectAll({ label = "All toppings" }: { label?: string }) {
  return (
    <CheckboxGroup.Parent>
      <Checkbox.Control>
        <Checkbox.Indicator>{glyph}</Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label>{label}</Checkbox.Label>
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
}
