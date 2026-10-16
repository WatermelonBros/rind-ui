"use client"

// Ported from apps/storybook/stories/Disclosure.stories.tsx: the foundation fixture, not a
// public component (Collapsible gets its own change).
import { DisclosureExample } from "../../../../packages/testing/fixtures/disclosure/disclosure.fixture"
import type { States, Variants } from "../types"

export const states: States = { disclosure: { closed: "Closed", open: "Open" } }

export function Closed() {
  return <DisclosureExample closeOnEscape />
}

export function Open() {
  return <DisclosureExample closeOnEscape defaultOpen />
}

export function EscapeDisabled() {
  return <DisclosureExample closeOnEscape={false} />
}

export const variants: Variants = {
  Closed: { title: "Closed", hidden: true },
  Open: { title: "Open", hidden: true },
  EscapeDisabled: { title: "Escape disabled", hidden: true },
}
