"use client"

import { Button, CheckboxGroup } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  const toppings = ["Ham", "Cheese", "Olives"]
  return (
    <CheckboxGroup.Root allValues={toppings} defaultValue={["Ham"]}>
      <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
      <CheckboxGroup.Parent>
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>
            {({ indeterminate }) => (indeterminate ? "–" : "✓")}
          </CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemLabel>All toppings</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Parent>
      {toppings.map((value) => (
        <CheckboxGroup.Item key={value} value={value}>
          <CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
          </CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemLabel>{value}</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
      ))}
    </CheckboxGroup.Root>
  )
}

export function Controlled() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
  const [value, setValue] = useState<readonly string[]>(["Mon", "Wed"])
  return (
    <div className="stack">
      <CheckboxGroup.Root value={value} onValueChange={setValue}>
        <CheckboxGroup.Label>Workdays</CheckboxGroup.Label>
        {days.map((day) => (
          <CheckboxGroup.Item key={day} value={day}>
            <CheckboxGroup.ItemControl>
              <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
            </CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemLabel>{day}</CheckboxGroup.ItemLabel>
          </CheckboxGroup.Item>
        ))}
      </CheckboxGroup.Root>
      <div className="row">
        <Button onPress={() => setValue(days)}>Every day</Button>
        <span className="note">[{value.join(", ")}]</span>
      </div>
    </div>
  )
}

export function Required() {
  const [value, setValue] = useState<readonly string[]>([])
  return (
    <CheckboxGroup.Root
      required
      invalid={value.length === 0}
      value={value}
      onValueChange={setValue}
    >
      <CheckboxGroup.Label>Notify me by</CheckboxGroup.Label>
      <CheckboxGroup.Description>Pick at least one.</CheckboxGroup.Description>
      {["Email", "SMS", "Push"].map((channel) => (
        <CheckboxGroup.Item key={channel} value={channel}>
          <CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
          </CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemLabel>{channel}</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
      ))}
      <CheckboxGroup.ErrorMessage>Choose at least one channel.</CheckboxGroup.ErrorMessage>
    </CheckboxGroup.Root>
  )
}

export function Disabled() {
  return (
    <div className="stack">
      <CheckboxGroup.Root defaultValue={["Read"]}>
        <CheckboxGroup.Label>Permissions</CheckboxGroup.Label>
        <CheckboxGroup.Item value="Read">
          <CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
          </CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemLabel>Read</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
        <CheckboxGroup.Item value="Write">
          <CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
          </CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemLabel>Write</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
        <CheckboxGroup.Item value="Admin" disabled>
          <CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
          </CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemLabel>Admin (owners only)</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
      </CheckboxGroup.Root>
    </div>
  )
}

export function InForm() {
  const sizes = ["S", "M", "L"]
  const [sent, setSent] = useState("Submit to see the form data")
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(`size=${new FormData(e.currentTarget).getAll("size").join(", ") || "—"}`)
      }}
    >
      <CheckboxGroup.Root name="size" allValues={sizes} defaultValue={["M"]}>
        <CheckboxGroup.Label>Sizes in stock</CheckboxGroup.Label>
        <CheckboxGroup.Parent>
          <CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemIndicator>
              {({ indeterminate }) => (indeterminate ? "–" : "✓")}
            </CheckboxGroup.ItemIndicator>
          </CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemLabel>All sizes</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Parent>
        {sizes.map((size) => (
          <CheckboxGroup.Item key={size} value={size}>
            <CheckboxGroup.ItemControl>
              <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
            </CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemLabel>{size}</CheckboxGroup.ItemLabel>
          </CheckboxGroup.Item>
        ))}
      </CheckboxGroup.Root>
      <div className="row">
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
      </div>
      <span className="note">{sent}</span>
    </form>
  )
}

export function AloneBasic() {
  return (
    <div className="stack">
      {[
        ["Keyboard support", true],
        ["Screen reader support", true],
        ["Your design", false],
      ].map(([label, on]) => (
        <CheckboxGroup.Item key={String(label)} defaultChecked={Boolean(on)}>
          <CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemIndicator>
              {({ indeterminate }) => (indeterminate ? "–" : "✓")}
            </CheckboxGroup.ItemIndicator>
          </CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemLabel>{label}</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
      ))}
    </div>
  )
}

export function AloneControlled() {
  const [checked, setChecked] = useState<boolean | "indeterminate">(false)
  return (
    <div className="stack">
      <CheckboxGroup.Item checked={checked} onCheckedChange={setChecked}>
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemLabel>Subscribe to the newsletter</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Item>
      <span className="note">checked: {String(checked)}</span>
    </div>
  )
}

export function AloneIndeterminate() {
  const [items, setItems] = useState([true, false, false])
  const all = items.every(Boolean)
  const some = items.some(Boolean)
  return (
    <div className="stack">
      <CheckboxGroup.Item
        checked={all ? true : some ? "indeterminate" : false}
        onCheckedChange={() => setItems(items.map(() => !all))}
      >
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>
            {({ indeterminate }) => (indeterminate ? "–" : "✓")}
          </CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemLabel>Select all</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Item>
      {["Email", "SMS", "Push"].map((label, i) => (
        <CheckboxGroup.Item
          key={label}
          checked={items[i] ?? false}
          onCheckedChange={(next) => setItems(items.map((on, j) => (j === i ? next === true : on)))}
        >
          <CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
          </CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemLabel>{label}</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
      ))}
    </div>
  )
}

export function AloneDisabled() {
  return (
    <div className="stack">
      <CheckboxGroup.Item disabled>
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemLabel>Disabled</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Item>
      <CheckboxGroup.Item disabled defaultChecked>
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemLabel>Disabled and checked</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Item>
    </div>
  )
}

export function AloneWithDescription() {
  return (
    <CheckboxGroup.Item>
      <CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>Accept the terms</CheckboxGroup.ItemLabel>
      <CheckboxGroup.ItemDescription>You can withdraw at any time.</CheckboxGroup.ItemDescription>
    </CheckboxGroup.Item>
  )
}

export function AloneInForm() {
  const [data, setData] = useState("")
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault()
        setData(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))))
      }}
    >
      <CheckboxGroup.Item name="terms" required>
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemLabel>Accept the terms (required)</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Item>
      <CheckboxGroup.Item name="updates" value="yes" uncheckedValue="no">
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemLabel>Send me updates</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Item>
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
  Controlled: { title: "Controlled", description: "`value` and `onValueChange` on the Root." },
  Required: {
    title: "Required",
    description: "`required` means at least one item; `ErrorMessage` shows while `invalid`.",
  },
  Disabled: { title: "Disabled item", description: "`disabled` on one item; the rest still work." },
  InForm: {
    title: "In a form",
    description:
      "`name` on the Root submits each checked item once; the select-all Parent submits nothing. Reset restores `defaultValue`.",
  },
  AloneBasic: { title: "Alone, basic" },
  AloneControlled: { title: "Alone, controlled", description: "`checked` and `onCheckedChange`." },
  AloneIndeterminate: {
    title: "Alone, indeterminate",
    description:
      '`checked="indeterminate"` exposes `aria-checked="mixed"` for a select-all parent.',
  },
  AloneDisabled: { title: "Alone, disabled", description: "`disabled` ignores activation." },
  AloneWithDescription: {
    title: "Alone, with description",
    description: "`CheckboxGroup.ItemDescription` is wired into `aria-describedby`.",
  },
  AloneInForm: {
    title: "Alone, in a form",
    description: "`name`, `required`, `value` and `uncheckedValue` drive what the form submits.",
  },
}
