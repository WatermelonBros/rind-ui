"use client"

import { Label } from "@rind-ui/react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <div className="stack">
      <Label htmlFor="example-name">Name</Label>
      <input id="example-name" className="native" placeholder="Click the label" />
    </div>
  )
}

export function Wrapping() {
  return (
    <Label>
      Subscribe to the newsletter
      <input type="checkbox" />
    </Label>
  )
}

export function WithDescription() {
  return (
    <div className="stack">
      <Label htmlFor="example-email">Email</Label>
      <input
        id="example-email"
        className="native"
        type="email"
        aria-describedby="example-email-hint"
      />
      <span id="example-email-hint" className="note">
        We never share it.
      </span>
    </div>
  )
}

export function AsDiv() {
  return (
    <div className="stack">
      <Label render={<div />} htmlFor="example-nick">
        Nickname
      </Label>
      <input id="example-nick" className="native" />
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  Wrapping: {
    title: "Wrapping a control",
    description: "A control inside the label needs no `htmlFor`.",
  },
  WithDescription: {
    title: "With a description",
    description: "The label names the input; `aria-describedby` adds a hint.",
  },
  AsDiv: {
    title: "Rendered as another element",
    description: "`render` on a non-`<label>` still forwards focus to the `htmlFor` element.",
  },
}
