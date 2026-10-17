"use client"

import { Button, ColorChannelField, ColorField } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "color-field": { idle: "Hex" } }

export function Hex() {
  return (
    <ColorField.Root defaultValue="#FF3D8B">
      <ColorField.Label>Brand colour</ColorField.Label>
      <ColorField.Input />
    </ColorField.Root>
  )
}

export function Alpha() {
  return (
    <ColorField.Root defaultValue="#FF3D8B80" alpha>
      <ColorField.Label>Overlay</ColorField.Label>
      <ColorField.Input />
      <ColorField.Description>
        8-digit hex: the last two digits are the alpha.
      </ColorField.Description>
    </ColorField.Root>
  )
}

export function Css() {
  return (
    <ColorField.Root defaultValue="hsl(160, 60%, 40%)" format="css">
      <ColorField.Label>Any CSS colour</ColorField.Label>
      <ColorField.Input />
    </ColorField.Root>
  )
}

export function Channels() {
  const [color, setColor] = useState("#336699")
  return (
    <div className="row">
      {(["red", "green", "blue"] as const).map((channel) => (
        <ColorChannelField.Root
          key={channel}
          channel={channel}
          value={color}
          onValueChange={(c) =>
            setColor(
              `#${c.channels.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`,
            )
          }
        >
          <ColorChannelField.Label>
            {channel[0]?.toUpperCase() + channel.slice(1)}
          </ColorChannelField.Label>
          <ColorChannelField.Control>
            <ColorChannelField.Input />
          </ColorChannelField.Control>
        </ColorChannelField.Root>
      ))}
    </div>
  )
}

export function HueField() {
  return (
    <ColorChannelField.Root channel="hue" defaultValue="hsb(200, 50%, 50%)">
      <ColorChannelField.Label>Hue</ColorChannelField.Label>
      <ColorChannelField.Control>
        <ColorChannelField.Input />
      </ColorChannelField.Control>
    </ColorChannelField.Root>
  )
}

export function InAForm() {
  const [sent, setSent] = useState("")
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(String(new FormData(e.currentTarget).get("fill")))
      }}
    >
      <ColorField.Root name="fill" required>
        <ColorField.Label>Fill</ColorField.Label>
        <ColorField.Input />
      </ColorField.Root>
      <div className="row">
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
      </div>
      <p className="note">{sent}</p>
    </form>
  )
}

export const variants: Variants = {
  Hex: { title: "Hex", description: "Free text until Enter or blur; `#` optional, any case." },
  Alpha: { title: "Alpha", description: "`alpha` accepts and shows 8-digit hex." },
  Css: { title: "CSS", description: '`format="css"`: any colour a browser accepts.' },
  Channels: {
    title: "Channel fields",
    description: "Color Channel Fields: Number Inputs bound to one channel each.",
  },
  HueField: { title: "Hue in degrees", description: "Typed values clamp; 999 commits 360°." },
  InAForm: { title: "In a form", description: "Submits `#RRGGBB`; required blocks an empty one." },
}
