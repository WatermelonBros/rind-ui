import { Checkbox, CheckboxGroup } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, useState } from "react"
import { expect } from "storybook/test"
import { getCheckboxGroup } from "../../../packages/testing/src/components/checkbox-group"

const meta = {
  title: "Components/CheckboxGroup",
  component: CheckboxGroup.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof CheckboxGroup.Root>

/**
 * State stories: contract scope → state → story export (ARIA snapshot per state). The group has
 * one contract state; the Parent's three states have their own stories below.
 */
export const states = {
  "checkbox-group": { ready: "Default" },
}

export default meta
type Story = StoryObj<typeof meta>

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

export const Default: Story = {
  render: () => <Toppings defaultValue={["cheese"]} />,
}

export const WithParent: Story = {
  render: () => <Toppings parent defaultValue={["ham"]} />,
}

export const ParentUnchecked: Story = {
  render: () => <Toppings parent />,
}

export const ParentMixed: Story = {
  render: () => <Toppings parent defaultValue={["ham"]} />,
}

export const ParentChecked: Story = {
  render: () => <Toppings parent defaultValue={[...all]} />,
}

export const DisabledItem: Story = {
  render: () => <Toppings parent defaultValue={["ham"]} disabledItem="cheese" />,
}

export const DisabledGroup: Story = {
  render: () => <Toppings parent disabled defaultValue={["ham"]} />,
}

export const ReadOnly: Story = {
  render: () => <Toppings readOnly defaultValue={["ham", "cheese"]} />,
}

export const RequiredWithError: Story = {
  render: () => (
    <Toppings
      required
      invalid
      description="Pick at least one."
      error="Choose at least one topping."
    />
  ),
}

export const Controlled: Story = {
  render: () => {
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
  },
}

export const InFormWithReset: Story = {
  render: () => {
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
  },
}

export const Fieldset: Story = {
  render: () => (
    <CheckboxGroup.Root render={<fieldset />} defaultValue={["ham"]}>
      <CheckboxGroup.Label render={<legend />}>Toppings</CheckboxGroup.Label>
      {all.map((v) => (
        <Item key={v} value={v} />
      ))}
    </CheckboxGroup.Root>
  ),
}

/** The driver toggles items and the Parent the way a user would. */
export const DriverExample: Story = {
  render: () => <Toppings parent />,
  play: async ({ canvasElement }) => {
    const group = getCheckboxGroup(canvasElement, { name: "Toppings" })
    await expect(group.value()).resolves.toEqual([])
    await group.toggle("Ham")
    await expect(group.value()).resolves.toEqual(["ham"])
    await expect(group.parentState()).resolves.toBe("mixed")
    await group.toggleParent()
    await expect(group.parentState()).resolves.toBe("checked")
    await group.via("keyboard").toggleParent()
    await expect(group.value()).resolves.toEqual([])
    await group.toggleParent()
    await expect(group.value()).resolves.toEqual(["ham"])
  },
}
