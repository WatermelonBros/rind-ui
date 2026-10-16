"use client"

// Ported from apps/storybook/stories/Collapsible.stories.tsx
import { Collapsible } from "@rind-ui/react"
import { type ComponentProps, useState } from "react"
import type { States, Variants } from "../types"

/** State examples: contract scope → state → example export (ARIA snapshot per state). */
export const states: States = { collapsible: { closed: "Default", open: "InitiallyOpen" } }

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const
const chevron = "▸"

/** Content padding lives on an inner wrapper, so overflow: hidden never clips a focus ring. */
function Section({
  title,
  children,
  ...root
}: { title: string } & Omit<ComponentProps<typeof Collapsible.Root>, "title">) {
  return (
    <Collapsible.Root {...root}>
      <Collapsible.Trigger>
        <Collapsible.Indicator>{chevron}</Collapsible.Indicator>
        {title}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div style={{ padding: "var(--rind-space-2)" }}>{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export function Default() {
  return <Section title="Details">Some content that can be hidden.</Section>
}

export function InitiallyOpen() {
  return (
    <Section title="Details" defaultOpen>
      Open from the first render, with no transition.
    </Section>
  )
}

export function DisabledStory() {
  return (
    <div style={column}>
      <Section title="Disabled closed" disabled>
        Never shown.
      </Section>
      <Section title="Disabled open" disabled defaultOpen>
        Stays open.
      </Section>
    </div>
  )
}

export function ClosedContentUntilFound() {
  return (
    <Section title="until-found (default)" closedContent="until-found">
      Findable by the browser's search.
    </Section>
  )
}

export function ClosedContentHidden() {
  return (
    <Section title="hidden" closedContent="hidden">
      Kept in the document, not findable.
    </Section>
  )
}

export function ClosedContentUnmount() {
  return (
    <Section title="unmount" closedContent="unmount">
      Removed while closed.
    </Section>
  )
}

export function ControlledStory() {
  const [open, setOpen] = useState(false)
  return (
    <div style={column}>
      <Section title="Controlled" open={open} onOpenChange={setOpen}>
        Driven by state.
      </Section>
      <p>{open ? "Open" : "Closed"}</p>
      <button type="button" onClick={() => setOpen((o) => !o)}>
        Toggle from outside
      </button>
    </div>
  )
}

export function Nested() {
  return (
    <Section title="Outer" defaultOpen>
      <Section title="Inner">Nested content.</Section>
    </Section>
  )
}

export function ListReorder() {
  const [items, setItems] = useState(["One", "Two", "Three"])
  return (
    <div style={column}>
      <button type="button" onClick={() => setItems((l) => [...l].reverse())}>
        Reverse
      </button>
      {items.map((name) => (
        <Section key={name} title={name}>
          Content of {name}.
        </Section>
      ))}
    </div>
  )
}

/** Use the browser's find-in-page for "needle": the closed section opens. */
export function FindInPage() {
  return (
    <div>
      <div style={{ height: "120vh" }}>Scroll down.</div>
      <Section title="Hidden section">The needle is inside closed content.</Section>
      <div style={{ height: "40vh" }} />
    </div>
  )
}

/** The driver opens and closes the way a user would. */
export function DriverExample() {
  return <Section title="Driven">Driven content.</Section>
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true, motion: "keep" },
  InitiallyOpen: { title: "Initially open", hidden: true, motion: "keep" },
  DisabledStory: { title: "Disabled", hidden: true, motion: "keep" },
  ClosedContentUntilFound: { title: "Closed content until found", hidden: true, motion: "keep" },
  ClosedContentHidden: { title: "Closed content hidden", hidden: true, motion: "keep" },
  ClosedContentUnmount: { title: "Closed content unmount", hidden: true, motion: "keep" },
  ControlledStory: { title: "Controlled", hidden: true, motion: "keep" },
  Nested: { title: "Nested", hidden: true, motion: "keep" },
  ListReorder: { title: "List reorder", hidden: true, motion: "keep" },
  FindInPage: { title: "Find in page", hidden: true, motion: "keep" },
  DriverExample: { title: "Driver example", hidden: true, motion: "keep" },
}
