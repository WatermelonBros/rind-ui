"use client"

import { GridList, Popover, RindProvider, TagGroup } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "grid-list": { idle: "Candidates" } }

const PEOPLE = [
  { key: "ada", name: "Ada Lovelace", role: "Analyst" },
  { key: "grace", name: "Grace Hopper", role: "Compiler engineer" },
  { key: "alan", name: "Alan Turing", role: "Mathematician" },
  { key: "edsger", name: "Edsger Dijkstra", role: "Researcher" },
] as const

/** Rows with a selection checkbox and two actions each; a press on a row opens it. */
export function Candidates() {
  const [opened, setOpened] = useState<string | null>(null)
  return (
    <div>
      <GridList.Root selectionMode="multiple" onAction={(key) => setOpened(key)}>
        <GridList.Label>Candidates</GridList.Label>
        <GridList.List>
          {PEOPLE.map((p) => (
            <GridList.Item key={p.key} value={p.key}>
              <GridList.ItemCheckbox />
              <GridList.ItemText>{p.name}</GridList.ItemText>
              <GridList.ItemDescription>{p.role}</GridList.ItemDescription>
              <GridList.ItemControl aria-label={`Message ${p.name}`}>Message</GridList.ItemControl>
              <GridList.ItemControl aria-label={`Archive ${p.name}`}>Archive</GridList.ItemControl>
            </GridList.Item>
          ))}
        </GridList.List>
      </GridList.Root>
      <p aria-live="polite">{opened ? `Opened ${opened}` : ""}</p>
    </div>
  )
}

/** `layout="grid"`: cards in columns; ArrowUp/Down move by the measured column. */
export function Cards() {
  return (
    <GridList.Root layout="grid" selectionMode="single">
      <GridList.Label>Projects</GridList.Label>
      <GridList.List>
        {["Atlas", "Borealis", "Cirrus", "Dune", "Ember", "Fjord"].map((name) => (
          <GridList.Item key={name} value={name}>
            <GridList.ItemText>{name}</GridList.ItemText>
            <GridList.ItemControl aria-label={`Share ${name}`}>Share</GridList.ItemControl>
          </GridList.Item>
        ))}
      </GridList.List>
    </GridList.Root>
  )
}

/** `childNavigation="tab"`: Tab reaches the text fields; arrows stay in the field. */
export function TabMode() {
  return (
    <GridList.Root childNavigation="tab">
      <GridList.Label>Shopping list</GridList.Label>
      <GridList.List>
        {["Bread", "Milk", "Apples"].map((item) => (
          <GridList.Item key={item} value={item}>
            <GridList.ItemText>{item}</GridList.ItemText>
            <GridList.ItemControl
              render={(props) => (
                <input {...props} aria-label={`Quantity of ${item}`} defaultValue="1" size={3} />
              )}
            />
          </GridList.Item>
        ))}
      </GridList.List>
    </GridList.Root>
  )
}

/** Link rows: Enter or a press follows the link; links are never selected. */
export function Links() {
  return (
    <GridList.Root>
      <GridList.Label>Documents</GridList.Label>
      <GridList.List>
        {["Roadmap", "Budget", "Minutes"].map((doc) => (
          <GridList.Item key={doc} value={doc} href={`#${doc.toLowerCase()}`}>
            <GridList.ItemText>{doc}</GridList.ItemText>
          </GridList.Item>
        ))}
      </GridList.List>
    </GridList.Root>
  )
}

/** A disabled row stays focusable and announced; its controls are disabled too. */
export function DisabledRows() {
  return (
    <GridList.Root selectionMode="multiple">
      <GridList.Label>Seats</GridList.Label>
      <GridList.List>
        {["A1", "A2", "A3"].map((seat) => (
          <GridList.Item key={seat} value={seat} disabled={seat === "A2"}>
            <GridList.ItemCheckbox />
            <GridList.ItemText>Seat {seat}</GridList.ItemText>
            <GridList.ItemControl aria-label={`Details for ${seat}`}>Details</GridList.ItemControl>
          </GridList.Item>
        ))}
      </GridList.List>
    </GridList.Root>
  )
}

export function Empty() {
  return (
    <GridList.Root selectionMode="multiple">
      <GridList.Label>Invitations</GridList.Label>
      <GridList.List>
        <GridList.Empty>No invitations yet</GridList.Empty>
      </GridList.List>
    </GridList.Root>
  )
}

export function Rtl() {
  return (
    <RindProvider dir="rtl" locale="ar">
      <div dir="rtl">
        <GridList.Root selectionMode="single">
          <GridList.Label>الفريق</GridList.Label>
          <GridList.List>
            {["سارة", "عمر", "ليلى"].map((name) => (
              <GridList.Item key={name} value={name}>
                <GridList.ItemText>{name}</GridList.ItemText>
                <GridList.ItemControl aria-label={`مراسلة ${name}`}>مراسلة</GridList.ItemControl>
              </GridList.Item>
            ))}
          </GridList.List>
        </GridList.Root>
      </div>
    </RindProvider>
  )
}

/** A Tag Group inside a row handles its own keys; arrows leave it at its edges. */
export function NestedTags() {
  return (
    <GridList.Root>
      <GridList.Label>Issues</GridList.Label>
      <GridList.List>
        {[
          { key: "login", tags: ["bug", "auth"] },
          { key: "export", tags: ["feature"] },
        ].map((issue) => (
          <GridList.Item key={issue.key} value={issue.key}>
            <GridList.ItemText>{issue.key}</GridList.ItemText>
            <TagGroup.Root>
              <TagGroup.Label>Labels of {issue.key}</TagGroup.Label>
              <TagGroup.List>
                {issue.tags.map((t) => (
                  <TagGroup.Tag key={t} value={t}>
                    <TagGroup.TagText>{t}</TagGroup.TagText>
                  </TagGroup.Tag>
                ))}
              </TagGroup.List>
            </TagGroup.Root>
          </GridList.Item>
        ))}
      </GridList.List>
    </GridList.Root>
  )
}

/** In a Popover: rows with actions, the popover stays open while the list is used. */
export function InPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger>Recent files</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Content aria-label="Recent files">
            <GridList.Root onAction={() => {}}>
              <GridList.Label>Recent</GridList.Label>
              <GridList.List>
                {["notes.md", "plan.pdf", "logo.svg"].map((f) => (
                  <GridList.Item key={f} value={f}>
                    <GridList.ItemText>{f}</GridList.ItemText>
                    <GridList.ItemControl aria-label={`Remove ${f}`}>Remove</GridList.ItemControl>
                  </GridList.Item>
                ))}
              </GridList.List>
            </GridList.Root>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export const variants: Variants = {
  Candidates: {
    title: "Rows with actions",
    description:
      "A checkbox selects; a press on the row opens it; arrows reach each row's buttons.",
  },
  Cards: {
    title: "Cards grid",
    description: '`layout="grid"`: columns; ArrowUp and ArrowDown move by column.',
  },
  TabMode: {
    title: "Tab through fields",
    description: '`childNavigation="tab"`: Tab reaches the inputs, arrows stay inside them.',
  },
  Links: { title: "Link rows", description: "Enter or a press follows the row's link." },
  DisabledRows: {
    title: "Disabled rows",
    description: "Disabled rows stay focusable and announced; their controls are disabled.",
  },
  Empty: { title: "Empty", description: "The empty content in a named group." },
  Rtl: { title: "Right to left", description: "Arrows mirror: ArrowLeft enters the controls." },
  NestedTags: {
    title: "Nested Tag Group",
    description: "The nested group handles its own keys; arrows leave it at its edges.",
  },
  InPopover: { title: "In a Popover", description: "A short list of rows inside a popover." },
}
