"use client"

import { ColorSwatch } from "@rind-ui/react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <div className="row">
      <ColorSwatch.Root color="#FF3D8B" />
      <ColorSwatch.Root color="hsl(160, 60%, 40%)" />
      <ColorSwatch.Root color="#336699" />
    </div>
  )
}

export function Transparent() {
  return (
    <div className="row">
      <ColorSwatch.Root color="#FF3D8B80" />
      <ColorSwatch.Root color="#FF3D8B80" respectAlpha={false} />
      <ColorSwatch.Root color="transparent" />
    </div>
  )
}

export function Named() {
  return <ColorSwatch.Root color="#FF3D8B" colorName="Brand pink" aria-label="Primary" />
}

export function WithChildren() {
  return (
    <ColorSwatch.Root color="#336699">
      <span aria-hidden="true">✓</span>
    </ColorSwatch.Root>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic", description: 'A chip with `role="img"`, named by its colour.' },
  Transparent: {
    title: "Transparency",
    description: "Alpha below 1 sits on a checkerboard; `respectAlpha={false}` shows it opaque.",
  },
  Named: {
    title: "Design-token name",
    description: "`colorName` replaces the computed name; `aria-label` is added after it.",
  },
  WithChildren: { title: "Children", description: "A mark inside; the name is unchanged." },
}
