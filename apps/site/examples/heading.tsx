"use client"

import { Heading } from "@rind-ui/react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <>
      <Heading>Settings</Heading>
      <Heading.Level>
        <Heading>Profile</Heading>
        <Heading.Level>
          <Heading>Avatar</Heading>
        </Heading.Level>
      </Heading.Level>
    </>
  )
}

export function ExplicitLevel() {
  return (
    <div className="stack">
      <Heading level={4}>Fourth-level title</Heading>
      <Heading level={5}>Fifth-level title</Heading>
    </div>
  )
}

export function LevelOverride() {
  return (
    <Heading.Level level={4}>
      <Heading>Starts at level 4</Heading>
      <Heading.Level>
        <Heading>Then level 5</Heading>
      </Heading.Level>
    </Heading.Level>
  )
}

export function Reusable() {
  return (
    <>
      <Card title="Reusable card" />
      <Heading.Level>
        <Card title="Nested card" />
      </Heading.Level>
    </>
  )
}

function Card({ title }: { title: string }) {
  return (
    <div className="stack">
      <Heading>{title}</Heading>
      <p>The card never knows which level it renders at.</p>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  ExplicitLevel: {
    title: "Explicit level",
    description: "`level` sets the heading rank directly (1 to 6).",
  },
  LevelOverride: {
    title: "Section start",
    description: "`level` on `Heading.Level` sets where a section begins.",
  },
  Reusable: {
    title: "Reusable components",
    description: "A component renders `Heading` and takes its rank from where it is placed.",
  },
}
