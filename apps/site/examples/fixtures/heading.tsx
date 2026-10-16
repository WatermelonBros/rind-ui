"use client"

// Ported from apps/storybook/stories/Heading.stories.tsx
// Stories that skip levels on purpose (a lone h4, an h6 with no parents) turn off axe's
// `heading-order` only: `empty-heading` and every other rule stay on.
import { Heading, Portal, useHeadingLevel } from "@rind-ui/react"
import type { CSSProperties, ReactNode } from "react"
import type { States, Variants } from "../types"

export const states: States = {
  heading: { nested: "NestedSections", asDiv: "AsDiv" },
}

/** A bare Heading is level 2 (the page has the h1); each `Heading.Level` goes one deeper. */
const nested = () => (
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

export function NestedSections() {
  return nested()
}

/** An app shell anchors the outline: its root `Heading.Level level={1}` makes the first heading an h1. */
export function AnchoredRoot() {
  return (
    <Heading.Level level={1}>
      <Heading>Dashboard</Heading>
      <Heading.Level>
        <Heading>Activity</Heading>
      </Heading.Level>
    </Heading.Level>
  )
}

/** A consumer component that renders its own tag from the level in context. */
function CardTitle({ children }: { children: ReactNode }) {
  const level = useHeadingLevel()
  const Tag = `h${level}` as const
  return <Tag>{children}</Tag>
}

export function CardTitles() {
  return (
    <Heading.Level level={2}>
      <Heading>Projects</Heading>
      <Heading.Level>
        <section>
          <CardTitle>Website</CardTitle>
        </section>
        <section>
          <CardTitle>Mobile app</CardTitle>
        </section>
      </Heading.Level>
    </Heading.Level>
  )
}

/** React context crosses a portal: the heading in the portal is one level below its section. */
export function InPopover() {
  return (
    <Heading.Level level={2}>
      <Heading>Inbox</Heading>
      <Heading.Level>
        <Portal>
          <Heading>Message details</Heading>
        </Portal>
      </Heading.Level>
    </Heading.Level>
  )
}

/** A non-heading element gets `role="heading"` and `aria-level`. */
export function AsDiv() {
  return <Heading render={<div />}>Section title</Heading>
}

/** Level 2 on an `h4` tag: the explicit `aria-level` wins, so it is still exposed at level 2. */
export function AsH4() {
  return (
    // biome-ignore lint/a11y/useHeadingContent: Heading supplies the children
    <Heading level={2} render={<h4 />}>
      Level 2 on an h4
    </Heading>
  )
}

/** Six nested sections: the sixth heading is h6 (and a dev warning says the outline is deep). */
export function DepthWarning() {
  return (
    <Heading.Level level={1}>
      <Heading.Level>
        <Heading.Level>
          <Heading.Level>
            <Heading.Level>
              <Heading.Level>
                <Heading.Level>
                  <Heading>Too deep</Heading>
                </Heading.Level>
              </Heading.Level>
            </Heading.Level>
          </Heading.Level>
        </Heading.Level>
      </Heading.Level>
    </Heading.Level>
  )
}

/** Size is not level: the card shrinks its h2 to the level-4 size and the outline is unchanged. */
export function SizeOverride() {
  return (
    <Heading.Level level={2}>
      <div
        style={
          {
            "--rind-heading-2-font-size": "calc(var(--rind-text-sm) * 1.2143)",
          } as CSSProperties
        }
      >
        <Heading>Card title</Heading>
      </div>
      <Heading>Normal title</Heading>
    </Heading.Level>
  )
}

export function DriverExample() {
  return nested()
}

export const variants: Variants = {
  NestedSections: { title: "Nested sections", hidden: true },
  AnchoredRoot: { title: "Anchored root", hidden: true },
  CardTitles: { title: "Card titles", hidden: true },
  InPopover: { title: "In popover", hidden: true },
  AsDiv: { title: "As div", hidden: true },
  AsH4: { title: "As h4", hidden: true, axeDisable: ["heading-order"] },
  DepthWarning: { title: "Depth warning", hidden: true, axeDisable: ["heading-order"] },
  SizeOverride: { title: "Size override", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
