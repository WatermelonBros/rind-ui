"use client"

import { Button } from "@rind-ui/react"
import { useState } from "react"
import { AttributeReadout } from "./attribute-readout"
import type { Variants } from "./types"

export function Basic() {
  const [last, setLast] = useState("Press it any way you like")
  return (
    <div className="stack">
      <AttributeReadout>
        <Button onPress={({ modality }) => setLast(`Last press: ${modality}`)}>Press me</Button>
      </AttributeReadout>
      <span className="note">{last}</span>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "One press, every input",
    description:
      "Hover sets `data-hover` (never from touch); a press in progress sets `data-pressed`; `onPress` reports the modality.",
  },
}
