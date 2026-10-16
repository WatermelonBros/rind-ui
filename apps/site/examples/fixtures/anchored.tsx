"use client"

// Ported from apps/storybook/stories/AnchoredFixture.stories.tsx
// The positioning foundation fixture: not a public component (Popover, Menu... get their own).
import { AnchoredExample } from "../../../../packages/testing/fixtures/anchored/anchored.react"
import type { States, Variants } from "../types"

export const states: States = { anchored: { closed: "Closed", open: "Open" } }

export function Closed() {
  return <AnchoredExample />
}

export function Open() {
  return <AnchoredExample defaultOpen />
}

export function Popup() {
  return <AnchoredExample defaultOpen preset="popup" label="Popup" />
}

export function Dropdown() {
  return <AnchoredExample defaultOpen preset="dropdown" label="Dropdown" />
}

export function Submenu() {
  return (
    <div style={{ paddingInlineStart: "4rem" }}>
      <AnchoredExample
        defaultOpen
        preset="submenu"
        label="Submenu"
        positioning={{ side: "inline-end" }}
      />
    </div>
  )
}

/** A point anchor at a fixed viewport position (a context menu at the pointer). */
export function Pointer() {
  return (
    <AnchoredExample
      defaultOpen
      preset="pointer"
      label="Pointer"
      title="At the pointer"
      anchor={{ x: 200, y: 160 }}
    />
  )
}

const corner = (label: string, style: React.CSSProperties) => (
  <div style={{ position: "fixed", ...style }}>
    <AnchoredExample defaultOpen label={label} title={label} />
  </div>
)

/** Anchors in the four corners: every popup flips or shifts to stay in view. */
export function Edges() {
  return (
    <>
      {corner("Top start", { top: 8, insetInlineStart: 8 })}
      {corner("Top end", { top: 8, insetInlineEnd: 8 })}
      {corner("Bottom start", { bottom: 8, insetInlineStart: 8 })}
      {corner("Bottom end", { bottom: 8, insetInlineEnd: 8 })}
    </>
  )
}

export function RTL() {
  return (
    <div dir="rtl" lang="ar" style={{ paddingInlineStart: "4rem" }}>
      <AnchoredExample defaultOpen preset="submenu" positioning={{ side: "inline-end" }} />
    </div>
  )
}

/** A 320 px wide frame: the content is capped at the available width and scrolls. */
export function Narrow320() {
  return (
    <div style={{ width: 320, overflow: "hidden", border: "1px dashed currentcolor" }}>
      <AnchoredExample defaultOpen>
        <p style={{ width: 600 }}>Wide content that does not fit in 320 px and scrolls.</p>
      </AnchoredExample>
    </div>
  )
}

export function WithArrow() {
  return <AnchoredExample defaultOpen arrow label="Arrow" />
}

/** Mode "manual": no coordinates written; the consumer places it with CSS anchor positioning. */
export function ManualMode() {
  return (
    <>
      <style>{`
        [data-scope="anchored"][data-part="positioner"] {
          position: fixed;
          position-area: bottom;
        }
      `}</style>
      <AnchoredExample defaultOpen positioning={{ mode: "manual" }} label="Manual" />
    </>
  )
}

/** The positioner stays mounted (hidden) while closed, so reopening does not flash. */
export function KeepMounted() {
  return <AnchoredExample keepMounted label="Keep mounted" />
}

export const variants: Variants = {
  Closed: { title: "Closed", hidden: true },
  Open: { title: "Open", hidden: true },
  Popup: { title: "Popup", hidden: true },
  Dropdown: { title: "Dropdown", hidden: true },
  Submenu: { title: "Submenu", hidden: true },
  Pointer: { title: "Pointer", hidden: true },
  Edges: { title: "Edges", hidden: true },
  RTL: { title: "RTL", hidden: true },
  Narrow320: { title: "Narrow 320", hidden: true, viewport: "mobile" },
  WithArrow: { title: "With arrow", hidden: true },
  ManualMode: { title: "Manual mode", hidden: true },
  KeepMounted: { title: "Keep mounted", hidden: true },
}
