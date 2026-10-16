"use client"

import { Dialog, SearchField, type SearchFieldRootProps } from "@rind-ui/react"
import { type FormEvent, useState } from "react"
import type { States, Variants } from "./types"

/** `composing` needs an IME session: the driver reaches it. */
export const states: States = { "search-field": { idle: "Basic" } }

function SearchIcon() {
  return (
    <svg
      className="adorn-start"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

/** Label, a leading icon and the input; the clear trigger at the inline end. */
function Search({
  label,
  description,
  clearable = true,
  minLength,
  ...props
}: SearchFieldRootProps & {
  readonly label: string
  readonly description?: string
  readonly clearable?: boolean
  readonly minLength?: number
}) {
  return (
    <SearchField.Root {...props}>
      <SearchField.Label>{label}</SearchField.Label>
      <div className="adorned">
        <SearchIcon />
        <SearchField.Input minLength={minLength} />
        {clearable && (
          <SearchField.ClearTrigger className="adorn-end">
            <ClearIcon />
          </SearchField.ClearTrigger>
        )}
      </div>
      {description && <SearchField.Description>{description}</SearchField.Description>}
      <SearchField.ErrorMessage />
    </SearchField.Root>
  )
}

export function Basic() {
  return <Search label="Search books" defaultValue="tolkien" />
}

export function IconOnly() {
  return (
    <SearchField.Root>
      <div className="adorned">
        <SearchIcon />
        <SearchField.Input aria-label="Search" placeholder="Search" />
        <SearchField.ClearTrigger className="adorn-end">
          <ClearIcon />
        </SearchField.ClearTrigger>
      </div>
    </SearchField.Root>
  )
}

export function InDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Find a book</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Find a book</Dialog.Title>
            <Dialog.Description>
              Escape clears the text first; on an empty field it closes the dialog.
            </Dialog.Description>
            <Search label="Search books" defaultValue="dune" />
            <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function SearchForm() {
  const [last, setLast] = useState("nothing yet")
  return (
    <search>
      <form
        className="stack"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
        }}
      >
        <Search label="Search books" name="q" onSubmit={(value) => setLast(value || "(empty)")} />
        <span className="note" role="status">
          last search: {last}
        </span>
      </form>
    </search>
  )
}

const BOOKS = ["Dune", "Emma", "Ulysses", "Beloved", "Dubliners", "Middlemarch", "Persuasion"]

export function ControlledResults() {
  const [query, setQuery] = useState("du")
  const hits = BOOKS.filter((b) => b.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="stack">
      <Search label="Filter books" value={query} onValueChange={setQuery} />
      <span className="note" role="status">
        {hits.length} of {BOOKS.length} books
      </span>
      <ul>
        {hits.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  )
}

export function ReadOnly() {
  return <Search label="Read-only search" defaultValue="saved query" readOnly />
}

export function Disabled() {
  return <Search label="Disabled search" defaultValue="saved query" disabled />
}

export function InvalidInField() {
  return (
    <Search
      label="Search books"
      name="q"
      defaultValue="ab"
      minLength={3}
      validationMode="change"
      description="At least 3 characters."
    />
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "A leading icon and a `ClearTrigger`; Escape does the same from the keyboard.",
  },
  IconOnly: {
    title: "Icon only",
    description: 'No Label: the input carries `aria-label="Search"`.',
  },
  InDialog: {
    title: "Inside a Dialog",
    description: "Escape clears first; on an empty field the Dialog gets it and closes.",
  },
  SearchForm: {
    title: "Search form",
    description: "The native `<search>` landmark around a form; Enter calls `onSubmit`.",
  },
  ControlledResults: {
    title: "Controlled with results",
    description: "The parent filters a static list on every change.",
  },
  ReadOnly: { title: "Read-only", description: "Escape and the clear button do nothing." },
  Disabled: { title: "Disabled", description: "Ignores all input." },
  InvalidInField: {
    title: "Invalid in a Field",
    description: "`minLength`; clearing re-validates the Field.",
  },
}
