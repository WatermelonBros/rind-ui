"use client"

import { Editable, VisuallyHidden } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { editable: { preview: "Basic", edit: "Editing" } }

export function Basic() {
  const [saved, setSaved] = useState("Quarterly report")
  return (
    <div className="stack">
      <Editable.Root defaultValue="Quarterly report" onValueChange={setSaved}>
        <Editable.Label>Title</Editable.Label>
        <div className="row">
          <Editable.Area>
            <Editable.Preview />
            <Editable.Input />
          </Editable.Area>
          <Editable.Control>
            <Editable.EditTrigger>Edit</Editable.EditTrigger>
            <Editable.SubmitTrigger>Save</Editable.SubmitTrigger>
            <Editable.CancelTrigger>Cancel</Editable.CancelTrigger>
          </Editable.Control>
        </div>
      </Editable.Root>
      <p className="note">Saved: {saved}</p>
    </div>
  )
}

const lists = [
  { id: "groceries", name: "Groceries" },
  { id: "reading", name: "Reading list" },
  { id: "new", name: "" },
]

export function DoubleClick() {
  return (
    <ul className="editable-list">
      {lists.map(({ id, name }, i) => (
        <li key={id}>
          <Editable.Root defaultValue={name} activationMode="dblclick" placeholder="Untitled list">
            <Editable.Label>
              <VisuallyHidden>List {i + 1}</VisuallyHidden>
            </Editable.Label>
            <Editable.Area>
              <Editable.Preview />
              <Editable.Input />
            </Editable.Area>
          </Editable.Root>
        </li>
      ))}
    </ul>
  )
}

export function Multiline() {
  return (
    <Editable.Root
      defaultValue={"Ships on Friday.\nTell the support team first."}
      submitMode="enter"
    >
      <Editable.Label>Release note</Editable.Label>
      <Editable.Area>
        <Editable.Preview />
        <Editable.Input render={<textarea />} />
      </Editable.Area>
    </Editable.Root>
  )
}

export function Editing() {
  return (
    <Editable.Root defaultValue="Quarterly report" defaultEdit>
      <Editable.Label>Title</Editable.Label>
      <div className="row">
        <Editable.Area>
          <Editable.Preview />
          <Editable.Input />
        </Editable.Area>
        <Editable.Control>
          <Editable.SubmitTrigger>Save</Editable.SubmitTrigger>
          <Editable.CancelTrigger>Cancel</Editable.CancelTrigger>
        </Editable.Control>
      </div>
    </Editable.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "With triggers",
    description:
      "Press the title or Edit; Enter saves, Escape puts back the value from when editing began.",
  },
  DoubleClick: {
    title: "Double-click to edit",
    description:
      "A single press selects nothing; Enter and Space on the focused name still edit. Empty shows a placeholder.",
  },
  Editing: {
    title: "Editing",
    description: "defaultEdit: the field starts in edit mode, Save and Cancel shown.",
    hidden: true,
  },
  Multiline: {
    title: "Multiline",
    description: "A textarea: Enter is a newline, Ctrl/⌘+Enter saves, a press outside cancels.",
  },
}
