"use client"

import { Button, Heading, Link } from "@rind-ui/react"
import type { CSSProperties, ReactNode } from "react"

const panel: CSSProperties = {
  display: "grid",
  gap: "var(--rind-space-6)",
  alignContent: "start",
  // The panel is the satin faceplate; raised keys stand proud of it.
  padding: "clamp(var(--rind-space-6), 5vw, var(--rind-space-8))",
  background: "var(--rind-color-surface)",
  color: "var(--rind-color-text)",
  border: "var(--rind-border-width) solid var(--rind-color-border)",
  borderRadius: "var(--rind-radius-panel)",
  // A faceplate set into the page, not a card floating over it: an edge, no lift.
}

const row: CSSProperties = {
  display: "flex",
  gap: "var(--rind-space-2)",
  alignItems: "center",
  flexWrap: "wrap",
}

/** Key rows: equal columns that halve on a phone instead of stranding one key. */
const keys: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 7rem), 1fr))",
  gap: "var(--rind-space-2)",
}

const rule: CSSProperties = {
  border: 0,
  borderTop: "var(--rind-border-width) solid var(--rind-color-border)",
  margin: 0,
}

/** A row of controls under an engraved plate label (a caption, not a heading). */
const plateLabel: CSSProperties = {
  margin: 0,
  fontSize: "var(--rind-text-xs)",
  fontWeight: 650,
  letterSpacing: "var(--rind-tracking-label)",
  textTransform: "uppercase",
  color: "var(--rind-color-text-muted)",
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: "var(--rind-space-3)" }}>
      <p style={plateLabel}>{label}</p>
      {children}
    </div>
  )
}

function Panel({ scheme }: { scheme: "light" | "dark" }) {
  return (
    <section data-theme={scheme} aria-label={`${scheme} scheme`} style={panel}>
      <div style={{ display: "grid", gap: "var(--rind-space-2)" }}>
        <Heading level={2}>Workspace settings</Heading>
        <p style={{ margin: 0, maxWidth: "60ch", color: "var(--rind-color-text-muted)" }}>
          Changes apply to every brand that inherits this theme. Read the{" "}
          <Link href="#tokens">token reference</Link> or open the{" "}
          <Link href="#contrast">contrast report</Link> before shipping a new brand.
        </p>
      </div>

      <Group label="Keys">
        <div style={keys}>
          <Button data-variant="solid">Save changes</Button>
          <Button data-variant="soft">Preview</Button>
          <Button data-variant="outline">Duplicate</Button>
          <Button data-variant="ghost">Cancel</Button>
        </div>
      </Group>

      <hr style={rule} />

      <Group label="Sizes">
        <div style={row}>
          <Button data-size="sm">Small</Button>
          <Button data-size="md">Medium</Button>
          <Button data-size="lg">Large</Button>
        </div>
        <div style={row}>
          <Button data-size="sm" data-variant="outline">
            Small
          </Button>
          <Button data-size="md" data-variant="outline">
            Medium
          </Button>
          <Button data-size="lg" data-variant="outline">
            Large
          </Button>
        </div>
      </Group>

      <Group label="Tones">
        <div style={keys}>
          <Button data-tone="neutral">Neutral</Button>
          <Button data-tone="danger">Delete</Button>
          <Button data-tone="warning">Override</Button>
          <Button data-tone="success">Publish</Button>
        </div>
        <div style={keys}>
          <Button data-tone="neutral" data-variant="soft">
            Neutral
          </Button>
          <Button data-tone="danger" data-variant="soft">
            Delete
          </Button>
          <Button data-tone="warning" data-variant="soft">
            Override
          </Button>
          <Button data-tone="success" data-variant="soft">
            Publish
          </Button>
        </div>
      </Group>

      <Group label="States">
        <div style={row}>
          <Button disabled>Disabled</Button>
          <Button data-variant="outline" disabled>
            Disabled
          </Button>
          <Button pending>Saving</Button>
        </div>
      </Group>

      <hr style={rule} />

      <div style={{ display: "grid", gap: "var(--rind-space-1)" }}>
        <Heading level={3}>Level three heading</Heading>
        <Heading level={4}>Level four heading</Heading>
        <Heading level={5}>Level five heading</Heading>
      </div>
    </section>
  )
}

/**
 * The default look in one place: a console panel per colour scheme, with the components that
 * exist today. Change `?brand=` to see the whole system re-skin.
 */
export function Showcase() {
  return (
    <>
      <h1>Showcase</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))",
          gap: "var(--rind-space-6)",
          maxWidth: "72rem",
        }}
      >
        <Panel scheme="light" />
        <Panel scheme="dark" />
      </div>
    </>
  )
}
