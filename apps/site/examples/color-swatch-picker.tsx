"use client"

import { ColorSwatchPicker, type ColorSwatchPickerRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "radio-group": { idle: "Basic", focused: "Basic" } }

const PALETTE = ["#FF3D8B", "#FF8F3D", "#F5D90A", "#2EC27E", "#3D8BFF", "#8B3DFF"]

function Palette(props: ColorSwatchPickerRootProps & { readonly colors?: readonly string[] }) {
  const { colors = PALETTE, ...rest } = props
  return (
    <ColorSwatchPicker.Root aria-label="Palette" {...rest}>
      {colors.map((c) => (
        <ColorSwatchPicker.Item key={c} color={c}>
          <ColorSwatchPicker.Swatch />
          <ColorSwatchPicker.Indicator>✓</ColorSwatchPicker.Indicator>
        </ColorSwatchPicker.Item>
      ))}
    </ColorSwatchPicker.Root>
  )
}

export function Basic() {
  return <Palette defaultValue="#3D8BFF" />
}

export function NoMatch() {
  return <Palette value="#123456" />
}

export function Controlled() {
  const [color, setColor] = useState<string | null>(null)
  return (
    <div className="stack">
      <Palette value={color} onValueChange={(_c, d) => setColor(d.value.slice(0, 7))} />
      <p className="note">{color ?? "Nothing chosen"}</p>
    </div>
  )
}

export function DuplicateKeys() {
  return (
    <ColorSwatchPicker.Root aria-label="Status colours" defaultValue="#FF3D8B">
      <ColorSwatchPicker.Item color="#FF3D8B" value="primary" colorName="Primary">
        <ColorSwatchPicker.Swatch />
        <ColorSwatchPicker.Indicator>✓</ColorSwatchPicker.Indicator>
      </ColorSwatchPicker.Item>
      <ColorSwatchPicker.Item color="#FF3D8B" value="danger" colorName="Danger">
        <ColorSwatchPicker.Swatch />
        <ColorSwatchPicker.Indicator>✓</ColorSwatchPicker.Indicator>
      </ColorSwatchPicker.Item>
    </ColorSwatchPicker.Root>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic", description: "Arrows move and check; one tab stop." },
  NoMatch: { title: "No match", description: "A colour no swatch has checks nothing." },
  Controlled: { title: "Controlled", description: "Starts with nothing chosen." },
  DuplicateKeys: {
    title: "Same colour twice",
    description: "Told apart by their `value` keys and design-token names.",
  },
}
