"use client"

import { ToggleGroup } from "@rind-ui/react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <div className="stack">
      <ToggleGroup.Root aria-label="Left to right" defaultValue={["one"]}>
        <ToggleGroup.Item value="one">One</ToggleGroup.Item>
        <ToggleGroup.Item value="two">Two</ToggleGroup.Item>
        <ToggleGroup.Item value="three">Three</ToggleGroup.Item>
      </ToggleGroup.Root>
      <div dir="rtl">
        <ToggleGroup.Root aria-label="Right to left" defaultValue={["one"]}>
          <ToggleGroup.Item value="one">واحد</ToggleGroup.Item>
          <ToggleGroup.Item value="two">اثنان</ToggleGroup.Item>
          <ToggleGroup.Item value="three">ثلاثة</ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Logical keys",
    description:
      "Focus a group and press Arrow Right: NEXT moves right in the first group and left in the RTL one.",
  },
}
