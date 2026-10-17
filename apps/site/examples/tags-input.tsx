"use client"

import { Field, TagsInput, type TagsInputRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "tags-input": { idle: "Basic" } }

/** Label, then the control: the chips (each with its remove button), the input, the clear button. */
function Tags({
  label = "Tags",
  placeholder = "Add a tag",
  ...root
}: Omit<TagsInputRootProps, "children"> & {
  readonly label?: string
  readonly placeholder?: string
}) {
  return (
    <TagsInput.Root {...root}>
      <TagsInput.Label>{label}</TagsInput.Label>
      <TagsInput.Control data-variant="outline">
        <TagsInput.Chips />
        <TagsInput.Input placeholder={placeholder} />
        <TagsInput.ClearTrigger aria-label="Clear all" />
      </TagsInput.Control>
    </TagsInput.Root>
  )
}

export function Basic() {
  return <Tags defaultValue={["rome", "paris"]} />
}

export function EmailRecipients() {
  const [reason, setReason] = useState("")
  return (
    <div className="stack">
      <Tags
        label="Recipients"
        placeholder="name@example.com"
        delimiter={[",", ";"]}
        validate={(text) => text.includes("@") || "not an email"}
        onRefuse={(r) => setReason(r.reason)}
      />
      <span className="note">refused: {reason || "nothing yet"}</span>
    </div>
  )
}

export function MaxThree() {
  return <Tags label="Up to three" max={3} defaultValue={["a", "b"]} />
}

export function DuplicatesAllowed() {
  return <Tags label="Repeats allowed" allowDuplicates defaultValue={["la", "la"]} />
}

export function Editable() {
  return <Tags label="Editable" editable defaultValue={["rome", "paris"]} />
}

export function BlurAdd() {
  return <Tags label="Adds on blur" blurBehavior="add" />
}

export function ReadOnly() {
  return <Tags label="Read-only" readOnly defaultValue={["rome", "paris"]} />
}

export function Disabled() {
  return <Tags label="Disabled" disabled defaultValue={["rome", "paris"]} />
}

export function InField() {
  return (
    <Field.Root name="topics" required>
      <Field.Label>Topics</Field.Label>
      <TagsInput.Root>
        <TagsInput.Control data-variant="outline">
          <TagsInput.Chips />
          <TagsInput.Input />
        </TagsInput.Control>
      </TagsInput.Root>
      <Field.Description>At least one topic.</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  )
}

export function Rtl() {
  return (
    <div dir="rtl">
      <Tags label="الوسوم" placeholder="أضف وسمًا" defaultValue={["روما", "باريس"]} />
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Default", description: "Type and press Enter or a comma to add a tag." },
  EmailRecipients: {
    title: "Email recipients",
    description:
      'Commas and semicolons split a paste; `validate` refuses text without "@" and `onRefuse` says why.',
  },
  MaxThree: { title: "Maximum", description: "`max` stops at three tags; a fourth is refused." },
  DuplicatesAllowed: {
    title: "Duplicates allowed",
    description: "`allowDuplicates` lets the same tag appear twice.",
  },
  Editable: {
    title: "Editable",
    description:
      "Enter or a double press on a tag edits it; Escape cancels, an empty text removes.",
  },
  BlurAdd: {
    title: "Add on blur",
    description: '`blurBehavior="add"` turns the draft into a tag.',
  },
  ReadOnly: { title: "Read-only", description: "The tags are shown and cannot change." },
  Disabled: { title: "Disabled", description: "Out of the tab order; nothing can change." },
  InField: {
    title: "In a Field",
    description: "`required` and the Field's description and error message reach the input.",
  },
  Rtl: { title: "Right to left", description: "Chips flow from the right; keys follow `dir`." },
}
