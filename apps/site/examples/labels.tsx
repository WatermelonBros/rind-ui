"use client"

import { Label } from "@rind-ui/react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <div className="stack">
      <Label htmlFor="guide-email">
        Email <span aria-hidden="true">*</span>
      </Label>
      <input
        id="guide-email"
        className="native"
        type="email"
        required
        placeholder="Click the label"
      />
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "A native label, fixed",
    description:
      "Clicking the label focuses the input; the decorative asterisk stays out of the accessible name.",
  },
}
