import { RindProvider, ToggleGroup } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, useState } from "react"
import { expect } from "storybook/test"
import { getToggleGroup } from "../../../packages/testing/src/components/toggle-group"

const meta = {
  title: "Components/ToggleGroup",
  component: ToggleGroup.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof ToggleGroup.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  "toggle-group": { idle: "Single", focused: "Single" },
}

export default meta
type Story = StoryObj<typeof meta>

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const
const formats = ["bold", "italic", "underline"] as const
const names: Record<string, string> = { bold: "Bold", italic: "Italic", underline: "Underline" }

/** A "Format" group of three items, then the "After" button (the contract's `leave`). */
function Format({
  disabledItem,
  icons,
  ...root
}: {
  disabledItem?: string
  icons?: boolean
} & Omit<ComponentProps<typeof ToggleGroup.Root>, "children">) {
  return (
    <>
      <ToggleGroup.Root aria-label="Format" {...root}>
        {formats.map((v) => (
          <ToggleGroup.Item
            key={v}
            value={v}
            {...(v === disabledItem ? { disabled: true } : {})}
            {...(icons ? { "aria-label": names[v] } : {})}
          >
            {icons ? <span aria-hidden="true">{names[v]?.charAt(0)}</span> : names[v]}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <button type="button">After</button>
    </>
  )
}

export const Single: Story = {
  render: () => <Format defaultValue={["italic"]} />,
}

export const Multiple: Story = {
  render: () => <Format selectionMode="multiple" defaultValue={["bold", "italic"]} />,
}

export const DisallowEmpty: Story = {
  render: () => <Format disallowEmptySelection defaultValue={["bold"]} />,
}

export const Vertical: Story = {
  render: () => <Format orientation="vertical" defaultValue={["italic"]} />,
}

export const DisabledItem: Story = {
  render: () => <Format disabledItem="italic" defaultValue={["bold"]} />,
}

export const FocusableWhenDisabled: Story = {
  render: () => <Format disabled focusableWhenDisabled defaultValue={["bold"]} />,
}

/** The items are named by `aria-label`; the visible glyph is aria-hidden. */
export const IconOnly: Story = {
  render: () => <Format icons selectionMode="multiple" defaultValue={["bold"]} />,
}

export const RTL: Story = {
  render: () => (
    // The direction for the arrow keys comes from the provider, the layout from `dir`.
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Format defaultValue={["italic"]} />
      </div>
    </RindProvider>
  ),
}

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState<readonly string[]>(["bold"])
    return (
      <div style={column}>
        <Format selectionMode="multiple" value={value} onValueChange={setValue} />
        <p>{value.join(",") || "(none)"}</p>
        <button type="button" onClick={() => setValue(["underline"])}>
          Underline from outside
        </button>
      </div>
    )
  },
}

/** The driver presses items by pointer and keyboard the way a user would. */
export const DriverExample: Story = {
  render: () => <Format selectionMode="multiple" />,
  play: async ({ canvasElement }) => {
    const group = getToggleGroup(canvasElement, { name: "Format" })
    await expect(group.items()).resolves.toEqual(["Bold", "Italic", "Underline"])
    await expect(group.pressed()).resolves.toEqual([])
    await group.toggle("Italic")
    await expect(group.pressed()).resolves.toEqual(["Italic"])
    await group.via("keyboard").toggle("Underline")
    await expect(group.pressed()).resolves.toEqual(["Italic", "Underline"])
    await group.focusItem("Bold")
    await expect(group.pressed()).resolves.toEqual(["Italic", "Underline"])
  },
}
