"use client"

import { Collapsible } from "@rind-ui/react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <Collapsible.Root>
      <Collapsible.Trigger>
        <Collapsible.Indicator>▸</Collapsible.Indicator>
        Closed section
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="pad">You found the pineapple: find-in-page opened this section.</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Find a closed panel",
    description:
      "Press Cmd/Ctrl+F and search for “pineapple”: the browser reveals it and the section opens.",
  },
}
