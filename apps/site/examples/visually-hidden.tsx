"use client"

import { Button, VisuallyHidden } from "@rind-ui/react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <div className="row">
      <Button>
        <span aria-hidden="true">↑</span>
        <VisuallyHidden>Sort ascending</VisuallyHidden>
      </Button>
      <Button>
        <span aria-hidden="true">↓</span>
        <VisuallyHidden>Sort descending</VisuallyHidden>
      </Button>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Icon buttons with a name",
    description:
      "The arrows are hidden from assistive technology; screen readers read “Sort ascending”.",
  },
}
