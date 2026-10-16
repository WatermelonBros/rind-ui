"use client"

import { Badge, Button, VisuallyHidden } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <div className="row">
      <span>
        Search <Badge.Root>Beta</Badge.Root>
      </span>
      <Badge.Root data-variant="solid">New</Badge.Root>
      <Badge.Root data-variant="outline">Draft</Badge.Root>
    </div>
  )
}

export function Count() {
  const [count, setCount] = useState(3)
  return (
    <div className="row">
      <Button onPress={() => setCount((c) => c + 1)}>
        <VisuallyHidden>Comments</VisuallyHidden>
        <span aria-hidden="true">💬</span>{" "}
        <Badge.Root label={`${count} unread`}>{count}</Badge.Root>
      </Button>
    </div>
  )
}

export function Overflow() {
  // "99+" means nothing read aloud: `label` gives the words, the visible text is hidden.
  return (
    <span>
      Notifications <Badge.Root label="more than 99 notifications">99+</Badge.Root>
    </span>
  )
}

export function Dot() {
  return (
    <div className="row">
      <span>
        Inbox <Badge.Root label="unread messages" data-tone="danger" data-size="sm" />
      </span>
      <span>
        Sync (2 incoming) <Badge.Root aria-hidden="true">2</Badge.Root>
      </span>
    </div>
  )
}

export function Tones() {
  const tones = ["accent", "neutral", "success", "warning", "danger"]
  return (
    <div className="stack">
      {["soft", "solid", "outline"].map((variant) => (
        <div className="row" key={variant}>
          {tones.map((tone) => (
            <Badge.Root key={tone} data-variant={variant} data-tone={tone}>
              {tone}
            </Badge.Root>
          ))}
        </div>
      ))}
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "A `span` with no role: status text, never a live region.",
  },
  Count: {
    title: "Count on an icon button",
    description:
      'The button\'s name comes from its content: "Comments 3 unread". Press it to change the count.',
  },
  Overflow: {
    title: "Overflowing count",
    description:
      '`label="more than 99 notifications"` is what assistive technology reads for "99+".',
  },
  Dot: {
    title: "Dot and decorative",
    description:
      'An empty dot needs `label`; a badge the host already states is `aria-hidden="true"`.',
  },
  Tones: { title: "Variants and tones", description: "`data-variant` × `data-tone`." },
}
