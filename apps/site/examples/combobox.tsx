"use client"

import {
  Button,
  Combobox,
  type ComboboxItemData,
  type ComboboxRootProps,
  Dialog,
} from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/** `open` is a Combobox that starts open, so the popup is in the ARIA snapshot. */
export const states: States = { combobox: { closed: "Basic", open: "StartsOpen" } }

const CITIES: readonly ComboboxItemData[] = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
  { key: "prague", label: "Prague" },
  { key: "oslo", label: "Oslo" },
  { key: "lisbon", label: "Lisbon" },
]

const GROUPED: readonly ComboboxItemData[] = [
  { key: "rome", label: "Rome", section: { key: "it", label: "Italy" } },
  { key: "milan", label: "Milan", section: { key: "it", label: "Italy" } },
  { key: "paris", label: "Paris", section: { key: "fr", label: "France" } },
  { key: "lyon", label: "Lyon", section: { key: "fr", label: "France" } },
]

const row = (label: string) => (
  <>
    <Combobox.ItemText>{label}</Combobox.ItemText>
    <Combobox.ItemIndicator />
  </>
)

/** Label, the control with input and both buttons, and the popup with the listed items. */
function City({
  label = "City",
  items = CITIES,
  empty = "No results",
  ...root
}: Omit<
  Extract<
    ComboboxRootProps,
    { readonly selectionMode?: "single" | "multiple"; readonly multiple?: false }
  >,
  "children" | "items"
> & {
  readonly label?: string
  readonly items?: readonly ComboboxItemData[]
  readonly empty?: string
}) {
  return (
    <Combobox.Root items={items} {...root}>
      <Combobox.Label>{label}</Combobox.Label>
      <Combobox.Control data-variant="outline">
        <Combobox.Input />
        <Combobox.ClearTrigger />
        <Combobox.Trigger />
      </Combobox.Control>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Items>{row}</Combobox.Items>
          </Combobox.List>
          <Combobox.Empty>{empty}</Combobox.Empty>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Root>
  )
}

export function Basic() {
  return <City defaultValue="paris" defaultInputValue="Paris" />
}

export function StartsOpen() {
  return <City label="Pick a city" defaultOpen />
}

export function Groups() {
  return <City label="City by country" items={GROUPED} />
}

export function DisabledOptions() {
  return (
    <City
      label="Some unavailable"
      items={CITIES.map((c) =>
        c.key === "oslo" || c.key === "prague" ? { ...c, disabled: true } : c,
      )}
    />
  )
}

export function CustomValue() {
  const [value, setValue] = useState<string | null>(null)
  const [text, setText] = useState("")
  return (
    <div className="stack">
      <City
        label="Any city"
        allowCustomValue
        value={value}
        onValueChange={(v) => setValue(v)}
        inputValue={text}
        onInputValueChange={setText}
      />
      <span className="note">
        value: {value ?? "none"}; text: {text || "empty"}
      </span>
    </div>
  )
}

export function InlineCompletion() {
  return <City label="Completes as you type" autoComplete="both" autoHighlight />
}

export function OpenOnFocus() {
  return <City label="Opens on focus" openOnFocus />
}

export function EmptyState() {
  return <City label="Nothing to pick" items={[]} empty="No cities yet" />
}

export function ReadOnly() {
  return <City label="Read-only" readOnly defaultValue="rome" defaultInputValue="Rome" />
}

export function Invalid() {
  return <City label="City (required)" invalid />
}

const FRUITS: readonly ComboboxItemData[] = [
  { key: "apple", label: "Apple" },
  { key: "apricot", label: "Apricot" },
  { key: "banana", label: "Banana" },
  { key: "cherry", label: "Cherry" },
  { key: "grape", label: "Grape" },
]

/** A search field: the text is the value, suggestions only fill it. */
function Search({ autoComplete }: { readonly autoComplete?: "list" | "both" }) {
  const [sent, setSent] = useState<string | null>(null)
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(String(new FormData(e.currentTarget).get("q") ?? ""))
      }}
    >
      <Combobox.Root
        items={FRUITS}
        selectionMode="none"
        name="q"
        {...(autoComplete ? { autoComplete } : {})}
      >
        <Combobox.Label>Search fruit</Combobox.Label>
        <Combobox.Control data-variant="outline">
          <Combobox.Input />
          <Combobox.ClearTrigger />
        </Combobox.Control>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              <Combobox.Items>
                {(label) => <Combobox.ItemText>{label}</Combobox.ItemText>}
              </Combobox.Items>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Root>
      <span className="note">submitted: {sent ?? "nothing yet"}</span>
    </form>
  )
}

export function Autocomplete() {
  return <Search />
}

export function AutocompleteCompletion() {
  return <Search autoComplete="both" />
}

interface Command extends ComboboxItemData {
  readonly shortcut?: string
  readonly tone?: "danger"
}

const COMMANDS: readonly Command[] = [
  {
    key: "new-file",
    label: "New file",
    shortcut: "Ctrl N",
    section: { key: "file", label: "File" },
  },
  { key: "save", label: "Save", shortcut: "Ctrl S", section: { key: "file", label: "File" } },
  {
    key: "theme",
    label: "Toggle theme",
    shortcut: "Ctrl T",
    section: { key: "view", label: "View" },
  },
  { key: "zoom", label: "Zoom in", shortcut: "Ctrl +", section: { key: "view", label: "View" } },
  {
    key: "delete",
    label: "Delete file",
    shortcut: "Ctrl Del",
    tone: "danger",
    section: { key: "file", label: "File" },
  },
]

/** The input and the list in place: no popup, the items run `onAction`. */
function Palette({
  items,
  ...root
}: Pick<ComboboxRootProps, "page" | "onBack" | "onAction" | "onOpenChange"> & {
  readonly items: readonly Command[]
}) {
  const byKey = new Map(items.map((c) => [c.key, c]))
  return (
    <Combobox.Root items={items} inline {...root}>
      <Combobox.Control data-variant="outline">
        <Combobox.Input aria-label="Search commands" placeholder="Type a command" />
      </Combobox.Control>
      <Combobox.List>
        <Combobox.Items>
          {(label, key) => {
            const c = byKey.get(key)
            return (
              <>
                <Combobox.ItemText>{label}</Combobox.ItemText>
                {c?.shortcut ? (
                  <Combobox.ItemDescription>{c.shortcut}</Combobox.ItemDescription>
                ) : null}
              </>
            )
          }}
        </Combobox.Items>
      </Combobox.List>
      <Combobox.Empty>No commands</Combobox.Empty>
    </Combobox.Root>
  )
}

export function CommandPalette() {
  const [last, setLast] = useState<string | null>(null)
  return (
    <div className="stack">
      <Palette items={COMMANDS} onAction={(key) => setLast(key)} />
      <span className="note">last action: {last ?? "none"}</span>
    </div>
  )
}

export function CommandPaletteInDialog() {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  return (
    <div className="stack">
      <Button onClick={() => setOpen(true)}>Open palette</Button>
      <Dialog.Root open={open} onOpenChange={(next) => setOpen(next)}>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title
                style={{
                  position: "absolute",
                  inlineSize: 1,
                  blockSize: 1,
                  overflow: "hidden",
                  clipPath: "inset(50%)",
                  whiteSpace: "nowrap",
                }}
              >
                Command palette
              </Dialog.Title>
              <Palette
                items={COMMANDS}
                onOpenChange={(o) => {
                  if (!o) setOpen(false)
                }}
                onAction={(key) => {
                  setLast(key)
                  setOpen(false)
                }}
              />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
      <span className="note">last action: {last ?? "none"}</span>
    </div>
  )
}

const ROOT_PAGE: readonly Command[] = [
  { key: "open-project", label: "Open project…" },
  { key: "save", label: "Save", shortcut: "Ctrl S" },
  { key: "theme", label: "Toggle theme", shortcut: "Ctrl T" },
]

const PROJECTS: readonly Command[] = [
  { key: "atlas", label: "Atlas" },
  { key: "harbor", label: "Harbor" },
  { key: "meadow", label: "Meadow" },
]

export function CommandPaletteWithPages() {
  const [projects, setProjects] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  return (
    <div className="stack">
      <Palette
        key={projects ? "projects" : "root"}
        items={projects ? PROJECTS : ROOT_PAGE}
        page={
          projects
            ? { key: "projects", label: "Projects", depth: 1 }
            : { key: "root", label: "Commands", depth: 0 }
        }
        onBack={() => setProjects(false)}
        onAction={(key) => {
          if (key === "open-project") setProjects(true)
          else setLast(key)
        }}
      />
      <span className="note">
        page: {projects ? "Projects" : "Commands"}; last action: {last ?? "none"}
      </span>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Default", description: "Type to filter; Arrow keys move, Enter selects." },
  StartsOpen: { title: "Starts open", hidden: true },
  Groups: { title: "Groups", description: "`section` on the items groups them under a label." },
  DisabledOptions: {
    title: "Disabled options",
    description: "Skipped by the arrow keys and refused by a press.",
  },
  CustomValue: {
    title: "Custom value",
    description: "`allowCustomValue` keeps text that matches no option as the value.",
  },
  InlineCompletion: {
    title: "Inline completion",
    description: '`autoComplete="both"` completes the text and selects the completed part.',
  },
  OpenOnFocus: {
    title: "Open on focus",
    description: "The popup opens when the input gets focus.",
  },
  EmptyState: {
    title: "Empty state",
    description: "`Combobox.Empty` shows while no option is listed.",
  },
  ReadOnly: { title: "Read-only", description: "The value is shown and cannot change." },
  Invalid: { title: "Invalid", description: "A doubled border as well as the colour." },
  Autocomplete: {
    title: "Autocomplete",
    description: '`selectionMode="none"`: the text is the value, submitted as `name`.',
  },
  AutocompleteCompletion: {
    title: "Autocomplete with completion",
    description: '`autoComplete="both"` completes the text as you type.',
  },
  CommandPalette: {
    title: "Command palette",
    description: "`inline` shows the list in place; `onAction` runs the item.",
  },
  CommandPaletteInDialog: {
    title: "Command palette in a dialog",
    description: "`onOpenChange(false)` closes the dialog; so does `onAction`.",
  },
  CommandPaletteWithPages: {
    title: "Command palette with pages",
    description: "`page` names the current page; Backspace on an empty query calls `onBack`.",
  },
}
