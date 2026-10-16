"use client"

// Ported from apps/storybook/stories/Accordion.stories.tsx
import { Accordion, Heading } from "@rind-ui/react"
import type { ComponentProps, ReactNode } from "react"
import type { States, Variants } from "../types"

/** State examples: contract scope → state → example export (ARIA snapshot per state). */
export const states: States = { accordion: { idle: "Default" } }

const chevron = "▸"
const topics = ["Shipping", "Returns", "Payment"] as const

/** Content padding lives on an inner wrapper, so overflow: hidden never clips a focus ring. */
function Entry({
  value,
  title,
  children,
  ...item
}: { title: string; children?: ReactNode } & Omit<
  ComponentProps<typeof Accordion.Item>,
  "title" | "children"
>) {
  return (
    <Accordion.Item value={value} {...item}>
      <Accordion.Header>
        <Accordion.Trigger>
          {title}
          <Accordion.Indicator>{chevron}</Accordion.Indicator>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content>
        <div style={{ padding: "var(--rind-space-2)" }}>{children ?? `${title} details.`}</div>
      </Accordion.Content>
    </Accordion.Item>
  )
}

function Faq({
  names = topics,
  ...props
}: Omit<ComponentProps<typeof Accordion.Root>, "children"> & { names?: readonly string[] }) {
  return (
    <Accordion.Root {...props}>
      {names.map((t) => (
        <Entry key={t} value={t.toLowerCase()} title={t} />
      ))}
    </Accordion.Root>
  )
}

const column = { maxWidth: "24rem" } as const

export function Default() {
  return (
    <div style={column}>
      <Faq />
    </div>
  )
}

export function Single() {
  return (
    <div style={column}>
      <Faq defaultValue={["shipping"]} />
    </div>
  )
}

export function MultipleStory() {
  return (
    <div style={column}>
      <Faq multiple defaultValue={["shipping", "payment"]} />
    </div>
  )
}

export function NonCollapsible() {
  return (
    <div style={column}>
      <Faq collapsible={false} defaultValue={["returns"]} />
    </div>
  )
}

export function DisabledItemStory() {
  return (
    <div style={column}>
      <Accordion.Root>
        <Entry value="a" title="Available">
          Open me.
        </Entry>
        <Entry value="b" title="Unavailable" disabled>
          Never shown.
        </Entry>
      </Accordion.Root>
    </div>
  )
}

export function HeadingLevels() {
  return (
    <div style={{ display: "grid", gap: "var(--rind-space-4)", ...column }}>
      <Faq headingLevel={2} defaultValue={["shipping"]} />
      <Heading.Level level={3}>
        <Faq names={["Warranty", "Support"]} />
      </Heading.Level>
    </div>
  )
}

const horizontal = (dir: "ltr" | "rtl") => (
  <div dir={dir} style={{ maxWidth: "48rem" }}>
    <Faq orientation="horizontal" keyboardNavigation dir={dir} defaultValue={["shipping"]} />
  </div>
)

export function HorizontalLtr() {
  return horizontal("ltr")
}

export function HorizontalRtl() {
  return horizontal("rtl")
}

export function KeyboardNavigationStory() {
  return (
    <div style={column}>
      <Faq keyboardNavigation />
    </div>
  )
}

/** Use the browser's find-in-page for "needle": the closed item opens. */
export function FindInPage() {
  return (
    <div>
      <div style={{ height: "120vh" }}>Scroll down.</div>
      <div style={column}>
        <Faq />
        <Accordion.Root>
          <Entry value="faq" title="Hidden item">
            The needle is inside closed content.
          </Entry>
        </Accordion.Root>
      </div>
      <div style={{ height: "40vh" }} />
    </div>
  )
}

export function Nested() {
  return (
    <div style={column}>
      <Accordion.Root defaultValue={["outer"]}>
        <Entry value="outer" title="Outer">
          <Faq />
        </Entry>
      </Accordion.Root>
    </div>
  )
}

/** The driver expands and collapses the way a user would. */
export function DriverExample() {
  return (
    <div style={column}>
      <Faq />
    </div>
  )
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  Single: { title: "Single", hidden: true },
  MultipleStory: { title: "Multiple", hidden: true },
  NonCollapsible: { title: "Non collapsible", hidden: true },
  DisabledItemStory: { title: "Disabled item", hidden: true },
  HeadingLevels: { title: "Heading levels", hidden: true },
  HorizontalLtr: { title: "Horizontal ltr", hidden: true },
  HorizontalRtl: { title: "Horizontal rtl", hidden: true },
  KeyboardNavigationStory: { title: "Keyboard navigation", hidden: true },
  FindInPage: { title: "Find in page", hidden: true },
  Nested: { title: "Nested", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
