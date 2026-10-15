"use client"

import { Link } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <p>
      Read the <Link href="/docs/">documentation</Link> or the{" "}
      <Link href="https://github.com/WatermelonBros/rind-ui">source</Link>.
    </p>
  )
}

export function External() {
  return (
    <Link href="https://github.com/WatermelonBros/rind-ui" target="_blank" rel="noreferrer">
      GitHub
    </Link>
  )
}

export function Current() {
  return (
    <nav className="row" aria-label="Sections">
      <Link href="/docs/" current="page">
        Docs
      </Link>
      <Link href="/lab/">Lab</Link>
    </nav>
  )
}

export function Disabled() {
  return (
    <div className="row">
      <Link href="/docs/" disabled>
        Disabled
      </Link>
      <Link href="/docs/" disabled focusableWhenDisabled>
        Disabled, still focusable
      </Link>
    </div>
  )
}

export function Activate() {
  const [where, setWhere] = useState("nothing yet")
  return (
    <div className="stack">
      <Link
        href="/docs/"
        onActivate={({ disposition, modality }) => setWhere(`${disposition} via ${modality}`)}
      >
        Documentation
      </Link>
      <span className="note">Opened: {where}</span>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  External: {
    title: "External",
    description: "An absolute `href` to another origin is marked `data-external`.",
  },
  Current: {
    title: "Current page",
    description: '`current="page"` sets `aria-current` for the active link.',
  },
  Disabled: {
    title: "Disabled",
    description: "`disabled` drops navigation; `focusableWhenDisabled` keeps it focusable.",
  },
  Activate: {
    title: "Activation",
    description: "`onActivate` reports where the link opened and how it was activated.",
  },
}
