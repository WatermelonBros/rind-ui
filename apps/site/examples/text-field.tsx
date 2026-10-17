"use client"

import { Button, Dialog, TextField, type TextFieldRootProps } from "@rind-ui/react"
import { type FormEvent, useState } from "react"
import type { States, Variants } from "./types"

// The password and search examples carry the idle state (the plain idle is the fixture's).
export const states: States = { "text-field": { idle: "Password" } }

/** `composing` needs an IME session: the driver reaches it. */

export function Basic() {
  return (
    <TextField.Root name="handle" required>
      <TextField.Label>Handle</TextField.Label>
      <TextField.Input placeholder="@you" maxLength={20} />
      <TextField.Description>Up to 20 characters.</TextField.Description>
      <TextField.ErrorMessage />
    </TextField.Root>
  )
}

export function Controlled() {
  const [value, setValue] = useState("Hello")
  return (
    <div className="stack">
      <TextField.Root value={value} onValueChange={setValue}>
        <TextField.Label>Greeting</TextField.Label>
        <TextField.Input />
      </TextField.Root>
      <div className="row">
        <Button type="button" onClick={() => setValue("")}>
          Empty
        </Button>
        <span className="note">Value: {value}</span>
      </div>
    </div>
  )
}

export function ClearTrigger() {
  return (
    <TextField.Root defaultValue="rind">
      <TextField.Label>Search</TextField.Label>
      <TextField.Input />
      <TextField.ClearTrigger />
    </TextField.Root>
  )
}

export function CharacterCount() {
  return (
    <div className="stack">
      <TextField.Root defaultValue="Hello">
        <TextField.Label>Handle</TextField.Label>
        <TextField.Input maxLength={12} />
        <TextField.CharacterCount />
      </TextField.Root>
      <TextField.Root defaultValue="This bio is a little too long">
        <TextField.Label>Bio</TextField.Label>
        <TextField.Textarea rows={2} />
        <TextField.CharacterCount max={20} />
      </TextField.Root>
    </div>
  )
}

export function AutosizeTextarea() {
  return (
    <TextField.Root>
      <TextField.Label>Message</TextField.Label>
      <TextField.Textarea autosize rows={2} placeholder="Write something long" />
    </TextField.Root>
  )
}

export function Validation() {
  return (
    <TextField.Root
      name="email"
      required
      validationMode="blur"
      validate={(value) => (String(value).endsWith("@example.com") ? "Use a real address." : null)}
    >
      <TextField.Label>Email</TextField.Label>
      <TextField.Input type="email" />
      <TextField.Description>example.com addresses are rejected.</TextField.Description>
      <TextField.ErrorMessage />
    </TextField.Root>
  )
}

export function DisabledAndReadOnly() {
  return (
    <div className="stack">
      <TextField.Root disabled defaultValue="Locked">
        <TextField.Label>Disabled</TextField.Label>
        <TextField.Input />
      </TextField.Root>
      <TextField.Root readOnly defaultValue="Copy me">
        <TextField.Label>Read-only</TextField.Label>
        <TextField.Input />
      </TextField.Root>
    </div>
  )
}

/** Eye and crossed eye: CSS shows the one that matches the Indicator's `data-state`. */
function EyeIcons() {
  return (
    <TextField.VisibilityIndicator className="eye">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <title>Eye</title>
        <path className="eye-on" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle className="eye-on" cx="12" cy="12" r="3" />
        <path
          className="eye-off"
          d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.2-1"
        />
      </svg>
    </TextField.VisibilityIndicator>
  )
}

/** Label, input with the visibility trigger inside its inline end. */
function PasswordField({
  label,
  description,
  autoComplete,
  ...props
}: TextFieldRootProps & {
  readonly label: string
  readonly description?: string
  readonly autoComplete?: string
}) {
  return (
    <TextField.Root type="password" {...props}>
      <TextField.Label>{label}</TextField.Label>
      <div className="adorned">
        <TextField.Input autoComplete={autoComplete} />
        <TextField.VisibilityTrigger className="adorn-end">
          <EyeIcons />
        </TextField.VisibilityTrigger>
      </div>
      {description && <TextField.Description>{description}</TextField.Description>}
      <TextField.ErrorMessage />
    </TextField.Root>
  )
}

export function Password() {
  return <PasswordField label="Password" name="password" defaultValue="hunter2" />
}

export function NewPassword() {
  return (
    <PasswordField
      label="New password"
      name="new-password"
      autoComplete="new-password"
      description="At least 12 characters."
    />
  )
}

export function PasswordControlled() {
  const [visible, setVisible] = useState(false)
  return (
    <div className="stack">
      <PasswordField
        label="Password"
        defaultValue="correct horse"
        visible={visible}
        onVisibleChange={setVisible}
      />
      <span className="note">visible: {String(visible)}</span>
    </div>
  )
}

export function PasswordReadOnly() {
  return <PasswordField label="Recovery key" defaultValue="7f3a-91bc" readOnly />
}

export function PasswordDisabled() {
  return <PasswordField label="Password" defaultValue="hunter2" disabled />
}

export function PasswordInvalid() {
  return (
    <PasswordField
      label="Password"
      name="password"
      defaultValue="abc"
      invalid
      errors={["Use at least 12 characters."]}
    />
  )
}

export function PasswordInForm() {
  const [submitted, setSubmitted] = useState(0)
  const [reason, setReason] = useState("none")
  return (
    <form
      className="stack"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        setSubmitted((n) => n + 1)
      }}
    >
      <PasswordField
        label="Password"
        name="password"
        defaultValue="hunter2"
        defaultVisible
        onVisibleChange={(_, d) => setReason(d.reason)}
      />
      <div className="row">
        <Button type="submit">Sign in</Button>
        <Button type="reset">Reset</Button>
      </div>
      <span className="note">
        submitted: {submitted} · last hide reason: {reason}
      </span>
    </form>
  )
}

export function VaultUnlockRecipe() {
  const [state, setState] = useState("locked")
  return (
    <form
      className="stack"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        setState(data.get("master") === "open sesame" ? "unlocked" : "wrong password")
      }}
    >
      <PasswordField
        label="Master password"
        name="master"
        autoComplete="off"
        description='Try "open sesame", then press Enter.'
      />
      <span className="note" role="status">
        vault: {state}
      </span>
    </form>
  )
}

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
function SearchField({
  label,
  description,
  minLength,
  ...props
}: TextFieldRootProps & {
  readonly label: string
  readonly description?: string
  readonly minLength?: number
}) {
  return (
    <TextField.Root type="search" {...props}>
      <TextField.Label>{label}</TextField.Label>
      <div className="adorned">
        <SearchIcon />
        <TextField.Input minLength={minLength} />
        <TextField.ClearTrigger className="adorn-end">
          <ClearIcon />
        </TextField.ClearTrigger>
      </div>
      {description && <TextField.Description>{description}</TextField.Description>}
      <TextField.ErrorMessage />
    </TextField.Root>
  )
}

export function Search() {
  return <SearchField label="Search books" defaultValue="tolkien" />
}

export function SearchIconOnly() {
  return (
    <TextField.Root type="search">
      <div className="adorned">
        <SearchIcon />
        <TextField.Input aria-label="Search" placeholder="Search" />
        <TextField.ClearTrigger className="adorn-end">
          <ClearIcon />
        </TextField.ClearTrigger>
      </div>
    </TextField.Root>
  )
}

export function SearchInDialog() {
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
            <SearchField label="Search books" defaultValue="dune" />
            <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function SearchWithSubmit() {
  const [last, setLast] = useState("nothing yet")
  return (
    <search>
      <form
        className="stack"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
        }}
      >
        <SearchField
          label="Search books"
          name="q"
          onSubmit={(value) => setLast(value || "(empty)")}
        />
        <span className="note" role="status">
          last search: {last}
        </span>
      </form>
    </search>
  )
}

const BOOKS = ["Dune", "Emma", "Ulysses", "Beloved", "Dubliners", "Middlemarch", "Persuasion"]

export function SearchControlledResults() {
  const [query, setQuery] = useState("du")
  const hits = BOOKS.filter((b) => b.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="stack">
      <SearchField label="Filter books" value={query} onValueChange={setQuery} />
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

export function SearchReadOnly() {
  return <SearchField label="Read-only search" defaultValue="saved query" readOnly />
}

export function SearchDisabled() {
  return <SearchField label="Disabled search" defaultValue="saved query" disabled />
}

export function SearchInvalid() {
  return (
    <SearchField
      label="Search books"
      name="q"
      defaultValue="ab"
      minLength={3}
      validationMode="change"
      description="At least 3 characters."
    />
  )
}

/** `escapeClears` is not only for search: any text field can opt in. */
export function EscapeClears() {
  return (
    <TextField.Root escapeClears defaultValue="Press Escape">
      <TextField.Label>Quick note</TextField.Label>
      <TextField.Input />
      <TextField.Description>Escape empties a non-empty field.</TextField.Description>
    </TextField.Root>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  Controlled: {
    title: "Controlled value",
    description: "`value` and `onValueChange` drive the input from state.",
  },
  ClearTrigger: {
    title: "Clear trigger",
    description:
      "`TextField.ClearTrigger` appears once there is text and keeps focus in the input.",
  },
  CharacterCount: {
    title: "Character count",
    description: "`maxLength` is a hard limit; `max` on `CharacterCount` is a soft one.",
  },
  AutosizeTextarea: {
    title: "Autosize textarea",
    description: "`autosize` grows the textarea with its content, starting from `rows`.",
  },
  Validation: {
    title: "Validation",
    description: "The Root takes Field props: `required`, `validate`, `validationMode`.",
  },
  DisabledAndReadOnly: {
    title: "Disabled and read-only",
    description: "`disabled` and `readOnly` apply to the input.",
  },
  Password: {
    title: "Password",
    description:
      '`type="password"` adds the `VisibilityTrigger`; `autoComplete` defaults to `current-password` and the trigger is named once.',
  },
  NewPassword: {
    title: "New password",
    description: '`autoComplete="new-password"` so a password manager offers to generate one.',
  },
  PasswordControlled: {
    title: "Controlled visibility",
    description: "`visible` and `onVisibleChange`.",
  },
  PasswordReadOnly: {
    title: "Read-only password",
    description: "The trigger still reveals the value.",
  },
  PasswordDisabled: { title: "Disabled password", description: "The trigger is disabled too." },
  PasswordInvalid: {
    title: "Invalid password",
    description: "`invalid` and `errors` reach the input and the indicator.",
  },
  PasswordInForm: {
    title: "Hidden on submit",
    description: "Starts revealed; a submit (even prevented) and a reset hide it.",
  },
  VaultUnlockRecipe: {
    title: "Vault unlock",
    description: "A password field alone in a form: Enter submits it.",
  },
  Search: {
    title: "Search",
    description:
      '`type="search"`: a searchbox, a leading icon and a `ClearTrigger` named "Clear search"; Escape does the same from the keyboard.',
  },
  SearchIconOnly: {
    title: "Icon-only search",
    description: 'No Label: the input carries `aria-label="Search"`.',
  },
  SearchInDialog: {
    title: "Search inside a Dialog",
    description: "Escape clears first; on an empty field the Dialog gets it and closes.",
  },
  SearchWithSubmit: {
    title: "Search with submit",
    description: "The native `<search>` landmark around a form; Enter calls `onSubmit`.",
  },
  SearchControlledResults: {
    title: "Controlled with results",
    description: "The parent filters a static list on every change.",
  },
  SearchReadOnly: {
    title: "Read-only search",
    description: "Escape and the clear button do nothing.",
  },
  SearchDisabled: { title: "Disabled search", description: "Ignores all input." },
  SearchInvalid: {
    title: "Invalid search",
    description: "`minLength`; clearing re-validates the Field.",
  },
  EscapeClears: {
    title: "Escape clears",
    description: "`escapeClears` on a plain text field (it is on by default for search).",
  },
}
