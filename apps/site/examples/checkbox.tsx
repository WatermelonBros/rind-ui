"use client"

import { Checkbox } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <div className="stack">
      {[
        ["Keyboard support", true],
        ["Screen reader support", true],
        ["Your design", false],
      ].map(([label, on]) => (
        <Checkbox.Root key={String(label)} defaultChecked={Boolean(on)}>
          <Checkbox.Control>
            <Checkbox.Indicator>
              {({ indeterminate }) => (indeterminate ? "–" : "✓")}
            </Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label>{label}</Checkbox.Label>
        </Checkbox.Root>
      ))}
    </div>
  )
}

export function Controlled() {
  const [checked, setChecked] = useState<boolean | "indeterminate">(false)
  return (
    <div className="stack">
      <Checkbox.Root checked={checked} onCheckedChange={setChecked}>
        <Checkbox.Control>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Control>
        <Checkbox.Label>Subscribe to the newsletter</Checkbox.Label>
      </Checkbox.Root>
      <span className="note">checked: {String(checked)}</span>
    </div>
  )
}

export function Indeterminate() {
  const [items, setItems] = useState([true, false, false])
  const all = items.every(Boolean)
  const some = items.some(Boolean)
  return (
    <div className="stack">
      <Checkbox.Root
        checked={all ? true : some ? "indeterminate" : false}
        onCheckedChange={() => setItems(items.map(() => !all))}
      >
        <Checkbox.Control>
          <Checkbox.Indicator>
            {({ indeterminate }) => (indeterminate ? "–" : "✓")}
          </Checkbox.Indicator>
        </Checkbox.Control>
        <Checkbox.Label>Select all</Checkbox.Label>
      </Checkbox.Root>
      {["Email", "SMS", "Push"].map((label, i) => (
        <Checkbox.Root
          key={label}
          checked={items[i] ?? false}
          onCheckedChange={(next) => setItems(items.map((on, j) => (j === i ? next === true : on)))}
        >
          <Checkbox.Control>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label>{label}</Checkbox.Label>
        </Checkbox.Root>
      ))}
    </div>
  )
}

export function Disabled() {
  return (
    <div className="stack">
      <Checkbox.Root disabled>
        <Checkbox.Control>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Control>
        <Checkbox.Label>Disabled</Checkbox.Label>
      </Checkbox.Root>
      <Checkbox.Root disabled defaultChecked>
        <Checkbox.Control>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Control>
        <Checkbox.Label>Disabled and checked</Checkbox.Label>
      </Checkbox.Root>
    </div>
  )
}

export function WithDescription() {
  return (
    <Checkbox.Root>
      <Checkbox.Control>
        <Checkbox.Indicator>✓</Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label>Accept the terms</Checkbox.Label>
      <Checkbox.Description>You can withdraw at any time.</Checkbox.Description>
    </Checkbox.Root>
  )
}

export function InForm() {
  const [data, setData] = useState("")
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault()
        setData(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))))
      }}
    >
      <Checkbox.Root name="terms" required>
        <Checkbox.Control>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Control>
        <Checkbox.Label>Accept the terms (required)</Checkbox.Label>
      </Checkbox.Root>
      <Checkbox.Root name="updates" value="yes" uncheckedValue="no">
        <Checkbox.Control>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Control>
        <Checkbox.Label>Send me updates</Checkbox.Label>
      </Checkbox.Root>
      <div className="row">
        <button type="submit">Submit</button>
        <button type="reset">Reset</button>
      </div>
      <span className="note">submitted: {data || "nothing yet"}</span>
    </form>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  Controlled: { title: "Controlled", description: "`checked` and `onCheckedChange`." },
  Indeterminate: {
    title: "Indeterminate",
    description:
      '`checked="indeterminate"` exposes `aria-checked="mixed"` for a select-all parent.',
  },
  Disabled: { title: "Disabled", description: "`disabled` ignores activation." },
  WithDescription: {
    title: "With description",
    description: "`Checkbox.Description` is wired into `aria-describedby`.",
  },
  InForm: {
    title: "In a form",
    description: "`name`, `required`, `value` and `uncheckedValue` drive what the form submits.",
  },
}
