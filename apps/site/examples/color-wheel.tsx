"use client"

import { type Color, formatColor, parseColor } from "@rind-ui/core"
import { ColorWheel } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "color-wheel": { idle: "Basic" } }

export function Basic() {
  const [color, setColor] = useState<Color>(() => parseColor("hsl(225 80% 55%)"))
  return (
    <div className="row wheel-row">
      <ColorWheel.Root value={color} onValueChange={setColor}>
        <ColorWheel.Label>Accent hue</ColorWheel.Label>
        <ColorWheel.Track>
          <ColorWheel.Thumb>
            <ColorWheel.Input />
          </ColorWheel.Thumb>
        </ColorWheel.Track>
        <ColorWheel.Value />
      </ColorWheel.Root>
      <div className="wheel-preview" style={{ background: formatColor(color, "css") }}>
        <span>{formatColor(color, "hex")}</span>
      </div>
    </div>
  )
}

export function Stepped() {
  return (
    <ColorWheel.Root defaultValue="hsl(0 70% 50%)" step={30}>
      <ColorWheel.Label>Tag colour</ColorWheel.Label>
      <ColorWheel.Track>
        <ColorWheel.Thumb>
          <ColorWheel.Input />
        </ColorWheel.Thumb>
      </ColorWheel.Track>
      <ColorWheel.Value />
    </ColorWheel.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Accent hue",
    description:
      "Press or drag on the ring (the hole ignores a press); arrows step 1°, Shift 15°. Saturation and lightness stay.",
  },
  Stepped: {
    title: "Twelve hues",
    description: "step 30: the hue snaps to the nearest of 12, and the value text names it.",
  },
}
