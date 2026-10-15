import { RadioGroup, RindProvider } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, useState } from "react"
import { expect } from "storybook/test"
import { getRadioGroup } from "../../../packages/testing/src/components/radio-group"

const meta = {
  title: "Components/RadioGroup",
  component: RadioGroup.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof RadioGroup.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  "radio-group": { idle: "Default", focused: "Default" },
}

export default meta
type Story = StoryObj<typeof meta>

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

export const Default: Story = {
  render: () => <Sizes defaultValue="medium" />,
}

export const Horizontal: Story = {
  render: () => <Sizes orientation="horizontal" defaultValue="medium" />,
}

export const WithDescriptions: Story = {
  render: () => <Sizes descriptions description="Pick one." defaultValue="small" />,
}

export const DisabledItem: Story = {
  render: () => <Sizes disabledItem="medium" defaultValue="small" />,
}

export const DisabledGroup: Story = {
  render: () => <Sizes disabled defaultValue="medium" />,
}

export const ReadOnly: Story = {
  render: () => <Sizes readOnly defaultValue="medium" />,
}

export const RequiredInvalid: Story = {
  render: () => (
    <Sizes required invalid description="Pick one." error="Choose a size to continue." />
  ),
}

export const InForm: Story = {
  render: () => {
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
  },
}

export const RTL: Story = {
  render: () => (
    // The direction for the arrow keys comes from the provider, the layout from `dir`.
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Sizes orientation="horizontal" defaultValue="medium" />
      </div>
    </RindProvider>
  ),
}

export const Controlled: Story = {
  render: () => {
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
  },
}

/** The driver checks radios by pointer and keyboard the way a user would. */
export const DriverExample: Story = {
  render: () => <Sizes name="size" />,
  play: async ({ canvasElement }) => {
    const group = getRadioGroup(canvasElement, { name: "Size" })
    await expect(group.radios()).resolves.toEqual(["Small", "Medium", "Large"])
    await expect(group.checked()).resolves.toBeNull()
    await group.check("Medium")
    await expect(group.checked()).resolves.toBe("Medium")
    await expect(group.formValue()).resolves.toEqual([["size", "medium"]])
    await group.via("keyboard").check("Large")
    await expect(group.checked()).resolves.toBe("Large")
    await group.focusRadio("Small")
    await expect(group.checked()).resolves.toBe("Large")
  },
}
