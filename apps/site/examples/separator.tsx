"use client"

import { Separator } from "@rind-ui/react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <div className="stack">
      <p>Account</p>
      <Separator.Root />
      <p>Billing</p>
      <Separator.Root />
      <p>Team</p>
    </div>
  )
}

export function Vertical() {
  return (
    <div className="row">
      <span>Docs</span>
      <Separator.Root orientation="vertical" />
      <span>Components</span>
      <Separator.Root orientation="vertical" />
      <span>GitHub</span>
    </div>
  )
}

export function Decorative() {
  return (
    <div className="stack">
      <p>A rule that is only decoration is hidden from assistive technology.</p>
      <Separator.Root decorative />
      <p>Screen readers skip it; it still draws.</p>
    </div>
  )
}

export function AsHr() {
  return (
    <div className="stack">
      <p>Chapter one</p>
      <Separator.Root render={<hr />} />
      <p>Chapter two</p>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic", description: '`role="separator"`, never focusable.' },
  Vertical: { title: "Vertical", description: '`orientation="vertical"` sets `aria-orientation`.' },
  Decorative: {
    title: "Decorative",
    description: '`decorative` renders `role="none"`: drawn, not announced.',
  },
  AsHr: {
    title: "As an hr",
    description: "`render={<hr />}` keeps the native element's semantics.",
  },
}
