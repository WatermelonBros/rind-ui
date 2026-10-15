"use client"

import { Button, RadioGroup } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <RadioGroup.Root defaultValue="Medium">
      <RadioGroup.Label>Size</RadioGroup.Label>
      {["Small", "Medium", "Large"].map((value) => (
        <RadioGroup.Item key={value} value={value}>
          <RadioGroup.ItemControl>
            <RadioGroup.ItemIndicator />
          </RadioGroup.ItemControl>
          <RadioGroup.ItemLabel>{value}</RadioGroup.ItemLabel>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}

export function Horizontal() {
  return (
    <RadioGroup.Root orientation="horizontal" defaultValue="Card">
      <RadioGroup.Label>Pay with</RadioGroup.Label>
      {["Card", "Transfer", "Wallet"].map((value) => (
        <RadioGroup.Item key={value} value={value}>
          <RadioGroup.ItemControl>
            <RadioGroup.ItemIndicator />
          </RadioGroup.ItemControl>
          <RadioGroup.ItemLabel>{value}</RadioGroup.ItemLabel>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}

export function WithDescriptions() {
  const plans = [
    ["Hobby", "One project, community support."],
    ["Pro", "Unlimited projects, email support."],
    ["Team", "Shared workspaces, SSO, priority support."],
  ] as const
  return (
    <RadioGroup.Root defaultValue="Pro">
      <RadioGroup.Label>Plan</RadioGroup.Label>
      {plans.map(([value, text]) => (
        <RadioGroup.Item key={value} value={value}>
          <RadioGroup.ItemControl>
            <RadioGroup.ItemIndicator />
          </RadioGroup.ItemControl>
          <RadioGroup.ItemLabel>{value}</RadioGroup.ItemLabel>
          <RadioGroup.ItemDescription>{text}</RadioGroup.ItemDescription>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}

export function Controlled() {
  const [value, setValue] = useState<string | null>("Daily")
  return (
    <div className="stack">
      <RadioGroup.Root value={value} onValueChange={setValue}>
        <RadioGroup.Label>Digest</RadioGroup.Label>
        {["Daily", "Weekly", "Never"].map((option) => (
          <RadioGroup.Item key={option} value={option}>
            <RadioGroup.ItemControl>
              <RadioGroup.ItemIndicator />
            </RadioGroup.ItemControl>
            <RadioGroup.ItemLabel>{option}</RadioGroup.ItemLabel>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      <span className="note">value: {value ?? "none"}</span>
    </div>
  )
}

export function Disabled() {
  return (
    <RadioGroup.Root defaultValue="Standard">
      <RadioGroup.Label>Shipping</RadioGroup.Label>
      <RadioGroup.Item value="Standard">
        <RadioGroup.ItemControl>
          <RadioGroup.ItemIndicator />
        </RadioGroup.ItemControl>
        <RadioGroup.ItemLabel>Standard</RadioGroup.ItemLabel>
      </RadioGroup.Item>
      <RadioGroup.Item value="Express">
        <RadioGroup.ItemControl>
          <RadioGroup.ItemIndicator />
        </RadioGroup.ItemControl>
        <RadioGroup.ItemLabel>Express</RadioGroup.ItemLabel>
      </RadioGroup.Item>
      <RadioGroup.Item value="Drone" disabled>
        <RadioGroup.ItemControl>
          <RadioGroup.ItemIndicator />
        </RadioGroup.ItemControl>
        <RadioGroup.ItemLabel>Drone (not in your area)</RadioGroup.ItemLabel>
      </RadioGroup.Item>
    </RadioGroup.Root>
  )
}

export function Required() {
  const [value, setValue] = useState<string | null>(null)
  return (
    <RadioGroup.Root required invalid={value === null} value={value} onValueChange={setValue}>
      <RadioGroup.Label>Seat</RadioGroup.Label>
      <RadioGroup.Description>Required to check in.</RadioGroup.Description>
      {["Window", "Aisle"].map((option) => (
        <RadioGroup.Item key={option} value={option}>
          <RadioGroup.ItemControl>
            <RadioGroup.ItemIndicator />
          </RadioGroup.ItemControl>
          <RadioGroup.ItemLabel>{option}</RadioGroup.ItemLabel>
        </RadioGroup.Item>
      ))}
      <RadioGroup.ErrorMessage>Choose a seat to continue.</RadioGroup.ErrorMessage>
    </RadioGroup.Root>
  )
}

export function InForm() {
  const [sent, setSent] = useState("Submit to see the form data")
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(`theme=${new FormData(e.currentTarget).get("theme") ?? "—"}`)
      }}
    >
      <RadioGroup.Root name="theme" defaultValue="Light">
        <RadioGroup.Label>Theme</RadioGroup.Label>
        {["Light", "Dark", "System"].map((option) => (
          <RadioGroup.Item key={option} value={option}>
            <RadioGroup.ItemControl>
              <RadioGroup.ItemIndicator />
            </RadioGroup.ItemControl>
            <RadioGroup.ItemLabel>{option}</RadioGroup.ItemLabel>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
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
  Horizontal: {
    title: "Horizontal",
    description: "`orientation` only sets `aria-orientation`; every arrow key still moves.",
  },
  WithDescriptions: {
    title: "With descriptions",
    description: "`ItemDescription` is part of each radio's accessible description.",
  },
  Controlled: { title: "Controlled", description: "`value` and `onValueChange`." },
  Disabled: { title: "Disabled item", description: "Arrow keys skip a `disabled` item." },
  Required: {
    title: "Required",
    description: "`required` and `invalid` mount the `ErrorMessage` in the group's description.",
  },
  InForm: {
    title: "In a form",
    description: "One `name` for the group; reset restores `defaultValue`.",
  },
}
