"use client"

import { Dialog, RindProvider, TagGroup } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "tag-group": { idle: "Removable" } }

/** A removable group: `onRemove` drops the keys from the data. */
function Removable_({
  initial,
  label,
}: {
  readonly initial: readonly string[]
  readonly label: string
}) {
  const [tags, setTags] = useState(initial)
  return (
    <TagGroup.Root onRemove={(keys) => setTags((all) => all.filter((t) => !keys.includes(t)))}>
      <TagGroup.Label>{label}</TagGroup.Label>
      <TagGroup.List>
        {tags.map((t) => (
          <TagGroup.Tag key={t} value={t}>
            <TagGroup.TagText>{t}</TagGroup.TagText>
            <TagGroup.TagRemove />
          </TagGroup.Tag>
        ))}
        <TagGroup.Empty>No cities left</TagGroup.Empty>
      </TagGroup.List>
    </TagGroup.Root>
  )
}

export function Removable() {
  return <Removable_ label="Cities" initial={["Rome", "Paris", "Oslo", "Lima"]} />
}

export function DisplayOnly() {
  return (
    <TagGroup.Root>
      <TagGroup.Label>Topics</TagGroup.Label>
      <TagGroup.List>
        {["Design", "Research", "Testing"].map((t) => (
          <TagGroup.Tag key={t} value={t}>
            <TagGroup.TagText>{t}</TagGroup.TagText>
          </TagGroup.Tag>
        ))}
      </TagGroup.List>
    </TagGroup.Root>
  )
}

export function FilterChips() {
  const [value, setValue] = useState<readonly string[]>(["open"])
  return (
    <div className="stack">
      <TagGroup.Root
        selectionMode="multiple"
        value={value}
        onValueChange={setValue}
        items={[
          { key: "open", label: "Open" },
          { key: "closed", label: "Closed" },
          { key: "draft", label: "Draft" },
        ]}
      >
        <TagGroup.Label>Status</TagGroup.Label>
        <TagGroup.List>
          <TagGroup.Tags>{(label) => <TagGroup.TagText>{label}</TagGroup.TagText>}</TagGroup.Tags>
        </TagGroup.List>
      </TagGroup.Root>
      <p className="note">Showing: {value.join(", ") || "everything"}</p>
    </div>
  )
}

export function SingleSelection() {
  return (
    <TagGroup.Root
      selectionMode="single"
      defaultValue="week"
      items={[
        { key: "day", label: "Day" },
        { key: "week", label: "Week" },
        { key: "month", label: "Month" },
      ]}
    >
      <TagGroup.Label>Range</TagGroup.Label>
      <TagGroup.List>
        <TagGroup.Tags>{(label) => <TagGroup.TagText>{label}</TagGroup.TagText>}</TagGroup.Tags>
      </TagGroup.List>
    </TagGroup.Root>
  )
}

export function SelectableAndRemovable() {
  const [tags, setTags] = useState(["Ada", "Grace", "Alan", "Edsger"])
  return (
    <TagGroup.Root
      selectionMode="multiple"
      defaultValue={[]}
      onRemove={(keys) => setTags((all) => all.filter((t) => !keys.includes(t)))}
    >
      <TagGroup.Label>Recipients</TagGroup.Label>
      <TagGroup.Description>
        Select several, then press Delete to remove them all.
      </TagGroup.Description>
      <TagGroup.List>
        {tags.map((t) => (
          <TagGroup.Tag key={t} value={t}>
            <TagGroup.TagText>{t}</TagGroup.TagText>
            <TagGroup.TagRemove />
          </TagGroup.Tag>
        ))}
        <TagGroup.Empty>No recipients</TagGroup.Empty>
      </TagGroup.List>
    </TagGroup.Root>
  )
}

export function ActionTags() {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      <TagGroup.Root onAction={(key) => setOpen(key)}>
        <TagGroup.Label>Labels</TagGroup.Label>
        <TagGroup.List>
          {["Bug", "Feature", "Docs"].map((t) => (
            <TagGroup.Tag key={t} value={t}>
              <TagGroup.TagText>{t}</TagGroup.TagText>
            </TagGroup.Tag>
          ))}
        </TagGroup.List>
      </TagGroup.Root>
      <Dialog.Root open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>{open}</Dialog.Title>
              <Dialog.Description>Issues with this label.</Dialog.Description>
              <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

export function LinkTags() {
  return (
    <TagGroup.Root>
      <TagGroup.Label>Related</TagGroup.Label>
      <TagGroup.List>
        <TagGroup.Tag value="dialog" href="/docs/dialog/">
          <TagGroup.TagText>Dialog</TagGroup.TagText>
        </TagGroup.Tag>
        <TagGroup.Tag value="popover" href="/docs/popover/">
          <TagGroup.TagText>Popover</TagGroup.TagText>
        </TagGroup.Tag>
      </TagGroup.List>
    </TagGroup.Root>
  )
}

export function DisabledTags() {
  return (
    <TagGroup.Root
      onRemove={() => {}}
      items={[
        { key: "a", label: "Available" },
        { key: "b", label: "Locked", disabled: true },
        { key: "c", label: "Pending" },
      ]}
    >
      <TagGroup.Label>Plans</TagGroup.Label>
      <TagGroup.List>
        <TagGroup.Tags />
      </TagGroup.List>
    </TagGroup.Root>
  )
}

export function Empty() {
  return <Removable_ label="Saved filters" initial={[]} />
}

export function RightToLeft() {
  return (
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Removable_ label="ערים" initial={["רומא", "פריז", "אוסלו"]} />
      </div>
    </RindProvider>
  )
}

export function LongText() {
  return (
    <div style={{ maxInlineSize: 260 }}>
      <Removable_
        label="Notes"
        initial={["A very long tag that does not fit the width of its group", "Short"]}
      />
    </div>
  )
}

export function SizesAndVariants() {
  return (
    <div className="stack">
      {(["soft", "solid", "outline"] as const).map((variant) => (
        <TagGroup.Root key={variant} data-variant={variant}>
          <TagGroup.Label>{variant}</TagGroup.Label>
          <TagGroup.List>
            {(["sm", "md", "lg"] as const).map((size) => (
              <TagGroup.Tag key={size} value={size} data-size={size}>
                <TagGroup.TagText>{size}</TagGroup.TagText>
              </TagGroup.Tag>
            ))}
          </TagGroup.List>
        </TagGroup.Root>
      ))}
    </div>
  )
}

export function DriverExample() {
  return <Removable_ label="Driver cities" initial={["Rome", "Paris"]} />
}

export const variants: Variants = {
  Removable: {
    title: "Removable",
    description: "Delete, Backspace or the button removes a tag; focus moves to its neighbour.",
  },
  DisplayOnly: {
    title: "Display-only",
    description: "No removal, selection, action or link: a plain list, no Tab stop.",
  },
  FilterChips: { title: "Filter chips", description: '`selectionMode="multiple"`: Space toggles.' },
  SingleSelection: { title: "Single selection", description: "One tag at a time." },
  SelectableAndRemovable: {
    title: "Selectable and removable",
    description: "Delete on a selected tag removes every selected tag.",
  },
  ActionTags: { title: "Action tags", description: "`onAction`: Enter or a press opens a dialog." },
  LinkTags: { title: "Link tags", description: "`href`: Enter follows the link." },
  DisabledTags: {
    title: "Disabled tags",
    description: "Reachable and announced as dimmed; never removed.",
  },
  Empty: {
    title: "Empty",
    description: "An empty group keeps its name and its Tab stop on the list.",
  },
  RightToLeft: { title: "Right to left", description: "ArrowLeft moves to the next tag." },
  LongText: { title: "Long text", description: "A tag fits the width with an ellipsis." },
  SizesAndVariants: { title: "Sizes and variants", description: "`data-variant` × `data-size`." },
  DriverExample: { title: "Driver example", hidden: true },
}
