"use client"

import type { Color } from "@rind-ui/core"
import { formatColor } from "@rind-ui/core"
import { Button, ColorArea, type ColorAreaRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/** An Area cannot be left mid-drag by a static render: `dragging` is reached by the driver. */
export const states: States = { "color-area": { idle: "Basic" } }

function Area(props: ColorAreaRootProps) {
  return (
    <ColorArea.Root aria-label="Fill" {...props}>
      <ColorArea.Background />
      <ColorArea.Thumb />
    </ColorArea.Root>
  )
}

export function Basic() {
  return <Area defaultValue="hsb(200, 60%, 70%)" />
}

export function Controlled() {
  const [color, setColor] = useState<Color | string>("#336699")
  return (
    <div className="stack">
      <Area value={color} onValueChange={setColor} colorSpace="hsb" />
      <p className="note">{typeof color === "string" ? color : formatColor(color, "hex")}</p>
    </div>
  )
}

export function HueAxis() {
  return <Area defaultValue="hsb(30, 80%, 90%)" xChannel="hue" yChannel="saturation" />
}

export function Hsl() {
  return <Area defaultValue="hsl(260, 60%, 50%)" />
}

export function Rgb() {
  return <Area defaultValue="rgb(200, 80, 120)" />
}

export function RightToLeft() {
  return (
    <div dir="rtl">
      <Area defaultValue="hsb(200, 60%, 70%)" dir="rtl" />
    </div>
  )
}

export function ReadOnly() {
  return <Area defaultValue="hsb(120, 50%, 60%)" readOnly />
}

export function InAForm() {
  const [sent, setSent] = useState("")
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(new URLSearchParams(new FormData(e.currentTarget) as never).toString())
      }}
    >
      <Area defaultValue="hsb(200, 50%, 80%)" xName="s" yName="b" />
      <div className="row">
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
      </div>
      <p className="note">{sent}</p>
    </form>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "Saturation × brightness; two range inputs, one tab stop.",
  },
  Controlled: {
    title: "Controlled",
    description: "A hex string in, an `rgb` colour out: the hue survives grey.",
  },
  HueAxis: { title: "Hue as an axis", description: '`xChannel="hue"`, `yChannel="saturation"`.' },
  Hsl: { title: "HSL", description: "Saturation × lightness." },
  Rgb: { title: "RGB", description: "Red × green, blue held." },
  RightToLeft: { title: "Right to left", description: "The x axis mirrors; the gradient follows." },
  ReadOnly: { title: "Read-only", description: "Focusable, changes nothing." },
  InAForm: { title: "In a form", description: "`xName` and `yName` submit the channels." },
}
