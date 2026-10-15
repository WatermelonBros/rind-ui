"use client"

import { Button, Checkbox, CheckboxGroup } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  const toppings = ["Ham", "Cheese", "Olives"]
  return (
    <CheckboxGroup.Root allValues={toppings} defaultValue={["Ham"]}>
      <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
      <CheckboxGroup.Parent>
        <Checkbox.Control>
          <Checkbox.Indicator>
            {({ indeterminate }) => (indeterminate ? "–" : "✓")}
          </Checkbox.Indicator>
        </Checkbox.Control>
        <Checkbox.Label>All toppings</Checkbox.Label>
      </CheckboxGroup.Parent>
      {toppings.map((value) => (
        <Checkbox.Root key={value} value={value}>
          <Checkbox.Control>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label>{value}</Checkbox.Label>
        </Checkbox.Root>
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
          <Checkbox.Root key={day} value={day}>
            <Checkbox.Control>
              <Checkbox.Indicator>✓</Checkbox.Indicator>
            </Checkbox.Control>
            <Checkbox.Label>{day}</Checkbox.Label>
          </Checkbox.Root>
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
        <Checkbox.Root key={channel} value={channel}>
          <Checkbox.Control>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label>{channel}</Checkbox.Label>
        </Checkbox.Root>
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
        <Checkbox.Root value="Read">
          <Checkbox.Control>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label>Read</Checkbox.Label>
        </Checkbox.Root>
        <Checkbox.Root value="Write">
          <Checkbox.Control>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label>Write</Checkbox.Label>
        </Checkbox.Root>
        <Checkbox.Root value="Admin" disabled>
          <Checkbox.Control>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label>Admin (owners only)</Checkbox.Label>
        </Checkbox.Root>
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
          <Checkbox.Control>
            <Checkbox.Indicator>
              {({ indeterminate }) => (indeterminate ? "–" : "✓")}
            </Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label>All sizes</Checkbox.Label>
        </CheckboxGroup.Parent>
        {sizes.map((size) => (
          <Checkbox.Root key={size} value={size}>
            <Checkbox.Control>
              <Checkbox.Indicator>✓</Checkbox.Indicator>
            </Checkbox.Control>
            <Checkbox.Label>{size}</Checkbox.Label>
          </Checkbox.Root>
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
}
