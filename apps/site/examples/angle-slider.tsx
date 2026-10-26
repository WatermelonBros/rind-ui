"use client"

import { AngleSlider } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "angle-slider": { idle: "Basic" } }

const marks = [0, 45, 90, 135, 180, 225, 270, 315]

export function Basic() {
  const [angle, setAngle] = useState(135)
  return (
    <div className="row angle-row">
      <AngleSlider.Root value={angle} onValueChange={setAngle}>
        <AngleSlider.Label>Gradient angle</AngleSlider.Label>
        <AngleSlider.Control>
          <AngleSlider.MarkerGroup>
            {marks.map((v) => (
              <AngleSlider.Marker key={v} value={v} />
            ))}
          </AngleSlider.MarkerGroup>
          <AngleSlider.Thumb>
            <AngleSlider.Input />
          </AngleSlider.Thumb>
        </AngleSlider.Control>
        <AngleSlider.Value />
      </AngleSlider.Root>
      <div
        className="angle-swatch"
        aria-hidden="true"
        style={{ backgroundImage: `linear-gradient(${angle}deg, var(--s-brand), var(--s-acc))` }}
      />
    </div>
  )
}

export function Stepped() {
  return (
    <AngleSlider.Root defaultValue={90} step={45} wrap={false}>
      <AngleSlider.Label>Wind direction</AngleSlider.Label>
      <AngleSlider.Control>
        <AngleSlider.MarkerGroup>
          {marks.map((v) => (
            <AngleSlider.Marker key={v} value={v} />
          ))}
        </AngleSlider.MarkerGroup>
        <AngleSlider.Thumb>
          <AngleSlider.Input />
        </AngleSlider.Thumb>
      </AngleSlider.Control>
      <AngleSlider.Value />
    </AngleSlider.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Gradient angle",
    description:
      "Press or drag on the dial; arrows step by 1°, Shift by 15°, and 359° wraps to 0°. The swatch follows.",
  },
  Stepped: {
    title: "Stepped, no wrap",
    description: "step 45 snaps to the nearest eighth; at 315° another step stays there.",
  },
}
