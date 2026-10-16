"use client"

// Ported from apps/storybook/stories/Separator.stories.tsx
import { Separator, SeparatorHostContext } from "@rind-ui/react"
import type { States, Variants } from "../types"

export const states: States = {
  separator: {
    horizontal: "Horizontal",
    vertical: "VerticalInRow",
    decorative: "DecorativeStory",
    labelled: "Labelled",
    toolbar: "InToolbar",
    menu: "InMenu",
    listbox: "InListbox",
  },
}

const column = { display: "grid", maxWidth: "24rem" } as const
const row = { display: "flex", alignItems: "center", gap: "var(--rind-space-2)" } as const

export function Horizontal() {
  return (
    <div style={column}>
      <p>Account</p>
      <Separator.Root />
      <p>Billing</p>
    </div>
  )
}

/** A vertical separator stretches to the height of the flex row. */
export function VerticalInRow() {
  return (
    <div style={{ ...row, alignItems: "stretch" }}>
      <button type="button">Docs</button>
      <Separator.Root orientation="vertical" />
      <button type="button">Blog</button>
    </div>
  )
}

/** Purely visual: `role="none"`, nothing in the accessibility tree. */
export function DecorativeStory() {
  return (
    <div style={column}>
      <p>Above</p>
      <Separator.Root decorative />
      <p>Below</p>
    </div>
  )
}

/** `hr` renders without children and keeps its implicit separator role. */
export function AsHrStory() {
  return (
    <div style={column}>
      <p>Above</p>
      <Separator.Root render={<hr />} />
      <p>Below</p>
    </div>
  )
}

export function Labelled() {
  return (
    <div style={column}>
      <p>Basic</p>
      <Separator.Root aria-label="Advanced settings" />
      <p>Network</p>
    </div>
  )
}

/** A toolbar tells its separators to be perpendicular to it. */
export function InToolbar() {
  return (
    <div role="toolbar" aria-label="Format" style={row}>
      <SeparatorHostContext value={{ context: "toolbar", defaultOrientation: "vertical" }}>
        <button type="button">Bold</button>
        <Separator.Root style={{ alignSelf: "stretch" }} />
        <button type="button">Italic</button>
      </SeparatorHostContext>
    </div>
  )
}

export function InMenu() {
  return (
    <div role="menu" aria-label="Edit" style={column}>
      <SeparatorHostContext value={{ context: "menu" }}>
        <div role="menuitem" tabIndex={-1}>
          Cut
        </div>
        <div role="menuitem" tabIndex={-1}>
          Copy
        </div>
        <Separator.Root />
        <div role="menuitem" tabIndex={-1}>
          Delete
        </div>
      </SeparatorHostContext>
    </div>
  )
}

/** `separator` is not an allowed child of a listbox: the role is always `none`. */
export function InListbox() {
  return (
    <div role="listbox" aria-label="Fruit" style={column}>
      <SeparatorHostContext value={{ context: "listbox" }}>
        <div role="option" aria-selected="false" tabIndex={-1}>
          Apple
        </div>
        <Separator.Root />
        <div role="option" aria-selected="false" tabIndex={-1}>
          Pear
        </div>
      </SeparatorHostContext>
    </div>
  )
}

/** The text sits beside two decorative rules: the separator itself holds no text. */
export function TextDivider() {
  return (
    <div style={{ ...row, maxWidth: "24rem" }}>
      <Separator.Root decorative style={{ flex: 1 }} />
      <span>or</span>
      <Separator.Root decorative style={{ flex: 1 }} />
    </div>
  )
}

export function DriverExample() {
  return (
    <div role="toolbar" aria-label="Tools">
      <SeparatorHostContext value={{ context: "toolbar", defaultOrientation: "vertical" }}>
        <Separator.Root />
      </SeparatorHostContext>
    </div>
  )
}

export const variants: Variants = {
  Horizontal: { title: "Horizontal", hidden: true },
  VerticalInRow: { title: "Vertical in row", hidden: true },
  DecorativeStory: { title: "Decorative", hidden: true },
  AsHrStory: { title: "As hr", hidden: true },
  Labelled: { title: "Labelled", hidden: true },
  InToolbar: { title: "In toolbar", hidden: true },
  InMenu: { title: "In menu", hidden: true },
  InListbox: { title: "In listbox", hidden: true },
  TextDivider: { title: "Text divider", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
