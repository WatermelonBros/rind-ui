"use client"

// Harness-only Comboboxes for the driver tests: a mirrored parent, a form and an async list.
import { Combobox, type ComboboxItemData } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "../types"

const ALL: readonly ComboboxItemData[] = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
  { key: "prague", label: "Prague" },
  { key: "oslo", label: "Oslo" },
]

function Parts() {
  return (
    <>
      <Combobox.Label>City</Combobox.Label>
      <Combobox.Control>
        <Combobox.Input />
        <Combobox.ClearTrigger />
        <Combobox.Trigger />
      </Combobox.Control>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Items />
          </Combobox.List>
          <Combobox.Empty>No results</Combobox.Empty>
        </Combobox.Popup>
      </Combobox.Positioner>
    </>
  )
}

/** The parent mirrors the text and the value, so the machine and the parent must agree. */
export function Mirrored() {
  const [text, setText] = useState("")
  const [value, setValue] = useState<string | null>(null)
  return (
    <div className="stack">
      <Combobox.Root
        items={ALL}
        inputValue={text}
        onInputValueChange={setText}
        value={value}
        onValueChange={(v) => setValue(v)}
      >
        <Parts />
      </Combobox.Root>
      <output data-testid="mirror">{`${text}|${value ?? ""}`}</output>
    </div>
  )
}

export function InForm() {
  const [data, setData] = useState("")
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setData(String(new FormData(e.currentTarget).get("city") ?? ""))
      }}
    >
      <Combobox.Root items={ALL} name="city" defaultValue="oslo" defaultInputValue="Oslo">
        <Parts />
      </Combobox.Root>
      <button type="submit">Submit</button>
      <output data-testid="submitted">{data}</output>
    </form>
  )
}

/** Server-side filtering: `filter: null`, and `itemsQuery` names the query the items answer. */
export function Async() {
  const [query, setQuery] = useState("")
  const items = ALL.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
  return (
    <Combobox.Root items={items} filter={null} itemsQuery={query} onInputValueChange={setQuery}>
      <Parts />
    </Combobox.Root>
  )
}

export const variants: Variants = {
  Mirrored: { title: "Mirrored", hidden: true },
  InForm: { title: "In a form", hidden: true },
  Async: { title: "Async", hidden: true },
}
