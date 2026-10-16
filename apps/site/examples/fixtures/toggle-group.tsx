"use client"

// Ported from apps/storybook/stories/ToggleGroup.stories.tsx
import { RindProvider, ToggleGroup } from "@rind-ui/react"
import { type ComponentProps, useState } from "react"
import type { States, Variants } from "../types"

export const states: States = {
  "toggle-group": { idle: "Single", focused: "Single" },
}

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

export function Single() {
  return <Format defaultValue={["italic"]} />
}

export function MultipleStory() {
  return <Format selectionMode="multiple" defaultValue={["bold", "italic"]} />
}

export function DisallowEmpty() {
  return <Format disallowEmptySelection defaultValue={["bold"]} />
}

export function VerticalStory() {
  return <Format orientation="vertical" defaultValue={["italic"]} />
}

export function DisabledItemStory() {
  return <Format disabledItem="italic" defaultValue={["bold"]} />
}

export function FocusableWhenDisabled() {
  return <Format disabled focusableWhenDisabled defaultValue={["bold"]} />
}

/** The items are named by `aria-label`; the visible glyph is aria-hidden. */
export function IconOnly() {
  return <Format icons selectionMode="multiple" defaultValue={["bold"]} />
}

export function RTL() {
  return (
    // The direction for the arrow keys comes from the provider, the layout from `dir`.
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Format defaultValue={["italic"]} />
      </div>
    </RindProvider>
  )
}

export function ControlledStory() {
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
}

/** The driver presses items by pointer and keyboard the way a user would. */
export function DriverExample() {
  return <Format selectionMode="multiple" />
}

export const variants: Variants = {
  Single: { title: "Single", hidden: true },
  MultipleStory: { title: "Multiple", hidden: true },
  DisallowEmpty: { title: "Disallow empty", hidden: true },
  VerticalStory: { title: "Vertical", hidden: true },
  DisabledItemStory: { title: "Disabled item", hidden: true },
  FocusableWhenDisabled: { title: "Focusable when disabled", hidden: true },
  IconOnly: { title: "Icon only", hidden: true },
  RTL: { title: "RTL", hidden: true },
  ControlledStory: { title: "Controlled", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
