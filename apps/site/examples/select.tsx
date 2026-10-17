"use client"

import { Button, Select } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { select: { closed: "Basic", open: "Open" } }

type Option = {
  key: string
  label: string
  disabled?: boolean
  section?: { key: string; label: string }
}

const FRUIT: Option[] = ["Apple", "Banana", "Cherry", "Grape", "Mango", "Peach"].map((f) => ({
  key: f.toLowerCase(),
  label: f,
}))

/** The popup: every option with its check. */
function Options({ items }: { readonly items: Option[] }) {
  return (
    <Select.Portal>
      <Select.Positioner>
        <Select.Content>
          <Select.List>
            {items.map((i) => (
              <Select.Item key={i.key} value={i.key} disabled={i.disabled ?? false}>
                <Select.ItemText>{i.label}</Select.ItemText>
                <Select.ItemIndicator>✓</Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.List>
        </Select.Content>
      </Select.Positioner>
    </Select.Portal>
  )
}

/** Label, trigger and a popup listing `items`: the parts every example repeats. */
function Picker({
  label,
  items,
  ...root
}: {
  readonly label: string
  readonly items: Option[]
  readonly defaultValue?: string
  readonly defaultOpen?: boolean
  readonly name?: string
  readonly required?: boolean
  readonly disabled?: boolean
}) {
  return (
    <Select.Root items={items} placeholder="Pick one" {...root}>
      <Select.Label>{label}</Select.Label>
      <Select.Trigger>
        <Select.ValueText />
        <Select.Indicator>▾</Select.Indicator>
      </Select.Trigger>
      <Options items={items} />
    </Select.Root>
  )
}

export function Basic() {
  return <Picker label="Fruit" items={FRUIT} defaultValue="banana" />
}

export function Open() {
  return <Picker label="Fruit" items={FRUIT} defaultValue="banana" defaultOpen />
}

export function Multiple() {
  const [value, setValue] = useState<readonly string[]>(["apple", "mango"])
  return (
    <div className="stack">
      <Select.Root
        items={FRUIT}
        placeholder="Pick some"
        multiple
        value={value}
        onValueChange={setValue}
      >
        <Select.Label>Toppings</Select.Label>
        <Select.Trigger>
          <Select.ValueText />
          <Select.Indicator>▾</Select.Indicator>
        </Select.Trigger>
        <Options items={FRUIT} />
      </Select.Root>
      <span className="note">value: {value.join(", ") || "none"}</span>
    </div>
  )
}

const TIMEZONES: Option[] = [
  { key: "lon", label: "London", section: { key: "eu", label: "Europe" } },
  { key: "rom", label: "Rome", section: { key: "eu", label: "Europe" } },
  { key: "ber", label: "Berlin", section: { key: "eu", label: "Europe" } },
  { key: "nyc", label: "New York", section: { key: "am", label: "Americas" } },
  { key: "sfo", label: "San Francisco", section: { key: "am", label: "Americas" } },
]

export function Sections() {
  const sections = [...new Map(TIMEZONES.map((t) => [t.section?.key, t.section])).values()]
  return (
    <Select.Root items={TIMEZONES} placeholder="Pick a city" defaultValue="rom">
      <Select.Label>Time zone</Select.Label>
      <Select.Trigger>
        <Select.ValueText />
        <Select.Indicator>▾</Select.Indicator>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Content>
            <Select.List>
              {sections.map((s) =>
                s ? (
                  <Select.Section key={s.key} section={s}>
                    {TIMEZONES.filter((t) => t.section?.key === s.key).map((t) => (
                      <Select.Item key={t.key} value={t.key}>
                        <Select.ItemText>{t.label}</Select.ItemText>
                        <Select.ItemIndicator>✓</Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Section>
                ) : null,
              )}
            </Select.List>
          </Select.Content>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

export function InForm() {
  const [sent, setSent] = useState("Submit to see the form data")
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(`fruit=${new FormData(e.currentTarget).get("fruit") || "(empty)"}`)
      }}
    >
      <Picker label="Fruit" items={FRUIT} name="fruit" required />
      <div className="row">
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
      </div>
      <span className="note">{sent}</span>
    </form>
  )
}

export function DisabledOptions() {
  return (
    <Picker
      label="Delivery"
      items={[
        { key: "std", label: "Standard" },
        { key: "exp", label: "Express" },
        { key: "same", label: "Same day (sold out)", disabled: true },
      ]}
      defaultValue="std"
    />
  )
}

export function Disabled() {
  return <Picker label="Fruit" items={FRUIT} defaultValue="apple" disabled />
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "Type a letter on the closed trigger to pick without opening; arrows open it.",
  },
  Multiple: {
    title: "Multiple",
    description: "`multiple`: each choice toggles and the popup stays open.",
  },
  Sections: { title: "Sections", description: "`Select.Section` with a `SectionLabel`." },
  InForm: {
    title: "In a form",
    description:
      "`name` submits the key; `required` uses the browser's validation; reset restores it.",
  },
  DisabledOptions: { title: "Disabled options", description: "Navigation skips them." },
  Disabled: { title: "Disabled", description: "`disabled` on the Root." },
  Open: { title: "Open", hidden: true },
}
