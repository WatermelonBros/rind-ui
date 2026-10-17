"use client"

import { Combobox, type ComboboxItemData, type ComboboxRootProps } from "@rind-ui/react"
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
}: Omit<Extract<ComboboxRootProps, { readonly multiple?: false }>, "children" | "items"> & {
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
}
