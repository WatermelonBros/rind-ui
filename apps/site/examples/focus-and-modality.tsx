"use client"

import { Button } from "@rind-ui/react"
import { AttributeReadout } from "./attribute-readout"
import type { Variants } from "./types"

export function Basic() {
  return (
    <AttributeReadout>
      <Button>Click me, then Tab to me</Button>
    </AttributeReadout>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Focus ring only from the keyboard",
    description:
      "Click: `data-focus` only. Tab: `data-focus` and `data-focus-visible`, so the ring shows.",
  },
}
