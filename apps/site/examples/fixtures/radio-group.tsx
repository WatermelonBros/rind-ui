"use client"

// Ported from apps/storybook/stories/RadioGroup.stories.tsx
import { RadioGroup, RindProvider } from "@rind-ui/react"
import { type ComponentProps, useState } from "react"
import type { States, Variants } from "../types"

export const states: States = {
  "radio-group": { idle: "Default", focused: "Default" },
}

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const
const sizes = ["small", "medium", "large"] as const
const names: Record<string, string> = { small: "Small", medium: "Medium", large: "Large" }

/** Label + items (+ optional Description, ErrorMessage) in a group, then the "After" button. */
function Sizes({
  items = sizes,
  disabledItem,
  descriptions,
  description,
  error,
  ...root
}: {
  items?: readonly string[]
  disabledItem?: string
  descriptions?: boolean
  description?: string
  error?: string
} & Omit<ComponentProps<typeof RadioGroup.Root>, "children">) {
  return (
    <>
      <RadioGroup.Root {...root}>
        <RadioGroup.Label>Size</RadioGroup.Label>
        {description && <RadioGroup.Description>{description}</RadioGroup.Description>}
        {items.map((v) => (
          <RadioGroup.Item key={v} value={v} {...(v === disabledItem ? { disabled: true } : {})}>
            <RadioGroup.ItemControl>
              <RadioGroup.ItemIndicator />
            </RadioGroup.ItemControl>
            <RadioGroup.ItemLabel>{names[v]}</RadioGroup.ItemLabel>
            {descriptions && (
              <RadioGroup.ItemDescription>{`The ${v} size.`}</RadioGroup.ItemDescription>
            )}
          </RadioGroup.Item>
        ))}
        {error && <RadioGroup.ErrorMessage>{error}</RadioGroup.ErrorMessage>}
      </RadioGroup.Root>
      <button type="button">After</button>
    </>
  )
}

export function Default() {
  return <Sizes defaultValue="medium" />
}

export function HorizontalStory() {
  return <Sizes orientation="horizontal" defaultValue="medium" />
}

export function WithDescriptionsStory() {
  return <Sizes descriptions description="Pick one." defaultValue="small" />
}

export function DisabledItem() {
  return <Sizes disabledItem="medium" defaultValue="small" />
}

export function DisabledGroup() {
  return <Sizes disabled defaultValue="medium" />
}

export function ReadOnly() {
  return <Sizes readOnly defaultValue="medium" />
}

export function RequiredInvalid() {
  return <Sizes required invalid description="Pick one." error="Choose a size to continue." />
}

export function InFormStory() {
  const [data, setData] = useState("(nothing submitted)")
  return (
    <form
      aria-label="Order"
      style={column}
      onSubmit={(e) => {
        e.preventDefault()
        setData(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))))
      }}
    >
      <Sizes name="size" required defaultValue="small" />
      <div style={{ display: "flex", gap: "var(--rind-space-2)" }}>
        <button type="submit">Submit</button>
        <button type="reset">Reset</button>
      </div>
      <output>{data}</output>
    </form>
  )
}

export function RTL() {
  return (
    // The direction for the arrow keys comes from the provider, the layout from `dir`.
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Sizes orientation="horizontal" defaultValue="medium" />
      </div>
    </RindProvider>
  )
}

export function ControlledStory() {
  const [value, setValue] = useState<string | null>("small")
  return (
    <div style={column}>
      <Sizes value={value} onValueChange={setValue} />
      <p>{String(value)}</p>
      <button type="button" onClick={() => setValue("large")}>
        Large from outside
      </button>
    </div>
  )
}

/** The driver checks radios by pointer and keyboard the way a user would. */
export function DriverExample() {
  return <Sizes name="size" />
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  HorizontalStory: { title: "Horizontal", hidden: true },
  WithDescriptionsStory: { title: "With descriptions", hidden: true },
  DisabledItem: { title: "Disabled item", hidden: true },
  DisabledGroup: { title: "Disabled group", hidden: true },
  ReadOnly: { title: "Read only", hidden: true },
  RequiredInvalid: { title: "Required invalid", hidden: true },
  InFormStory: { title: "In form", hidden: true },
  RTL: { title: "RTL", hidden: true },
  ControlledStory: { title: "Controlled", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
