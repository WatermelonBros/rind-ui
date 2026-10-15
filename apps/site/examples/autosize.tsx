"use client"

import { TextField } from "@rind-ui/react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <TextField.Root name="note" defaultValue="Type a few lines here: the textarea grows with them.">
      <TextField.Label>Note</TextField.Label>
      <TextField.Textarea autosize rows={2} />
    </TextField.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "A textarea that fits its text",
    description:
      "`autosize` with `rows={2}` as the minimum; the skin caps it with `max-block-size`.",
  },
}
