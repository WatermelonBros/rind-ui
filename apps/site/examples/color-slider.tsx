"use client"

import { ColorSlider, type ColorSliderRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { slider: { idle: "Hue" } }

function Bar({
  label,
  alpha,
  ...props
}: ColorSliderRootProps & { label?: string; alpha?: boolean }) {
  return (
    <ColorSlider.Root {...props}>
      {label ? <ColorSlider.Label>{label}</ColorSlider.Label> : null}
      <ColorSlider.ValueText />
      <ColorSlider.Control>
        <ColorSlider.Track>
          {alpha ? <ColorSlider.TransparencyGrid /> : null}
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider.Control>
    </ColorSlider.Root>
  )
}

export function Hue() {
  return <Bar channel="hue" defaultValue="hsb(220, 80%, 90%)" />
}

export function Alpha() {
  return <Bar channel="alpha" alpha defaultValue="#336699" label="Opacity" />
}

export function Channels() {
  const [color, setColor] = useState("hsb(200, 70%, 80%)")
  return (
    <div className="stack">
      {(["hue", "saturation", "brightness"] as const).map((channel) => (
        <Bar
          key={channel}
          channel={channel}
          value={color}
          onValueChange={(c) =>
            setColor(`hsb(${c.channels[0]}, ${c.channels[1]}%, ${c.channels[2]}%)`)
          }
        />
      ))}
    </div>
  )
}

export function Vertical() {
  return <Bar channel="hue" orientation="vertical" defaultValue="hsb(120, 80%, 90%)" />
}

export function RightToLeft() {
  return (
    <div dir="rtl">
      <Bar channel="alpha" alpha dir="rtl" defaultValue="#FF3D8B" />
    </div>
  )
}

export const variants: Variants = {
  Hue: { title: "Hue", description: "Unlabelled: the thumb is named by the channel." },
  Alpha: {
    title: "Alpha",
    description: "A Transparency Grid under the track shows through the gradient.",
  },
  Channels: { title: "Bound channels", description: "Three sliders on one colour." },
  Vertical: { title: "Vertical", description: "The gradient runs to the top." },
  RightToLeft: { title: "Right to left", description: "The gradient and the thumb mirror." },
}
