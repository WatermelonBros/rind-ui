"use client"

// Ported from apps/storybook/stories/Fieldset.stories.tsx
// DisabledStory and InvalidStory: renamed, the docs module already exports Disabled and Invalid.
import { Button, Fieldset } from "@rind-ui/react"
import type { States, Variants } from "../types"

export const states: States = {
  fieldset: { default: "AddressGroup", disabled: "DisabledStory" },
}

const column = { display: "grid", gap: "var(--rind-space-2)", maxWidth: "24rem" } as const

/** Native inputs with labels: no Text Field yet. */
export function AddressGroup() {
  return (
    <Fieldset.Root>
      <Fieldset.Legend>Shipping address</Fieldset.Legend>
      <Fieldset.Description>Where we send the parcel.</Fieldset.Description>
      <div style={column}>
        <label>
          Street <input type="text" />
        </label>
        <label>
          City <input type="text" />
        </label>
      </div>
    </Fieldset.Root>
  )
}

export function RadioSet() {
  return (
    <Fieldset.Root>
      <Fieldset.Legend>Delivery speed</Fieldset.Legend>
      <label>
        <input type="radio" name="speed" defaultChecked /> Standard
      </label>
      <label>
        <input type="radio" name="speed" /> Express
      </label>
    </Fieldset.Root>
  )
}

export function DisabledStory() {
  return (
    <Fieldset.Root disabled>
      <Fieldset.Legend>Shipping address</Fieldset.Legend>
      <div style={column}>
        <label>
          Street <input type="text" />
        </label>
        <Button>Save</Button>
      </div>
    </Fieldset.Root>
  )
}

/** The inner fieldset is enabled by itself, yet its controls follow the disabled ancestor. */
export function NestedDisabled() {
  return (
    <Fieldset.Root disabled>
      <Fieldset.Legend>Account</Fieldset.Legend>
      <Fieldset.Root>
        <Fieldset.Legend>Contact</Fieldset.Legend>
        <label>
          Phone <input type="tel" />
        </label>
        <Button>Call</Button>
      </Fieldset.Root>
    </Fieldset.Root>
  )
}

/** A control in the first legend is exempt from the disabled state (HTML). */
export function LegendWithSelectAll() {
  return (
    <Fieldset.Root disabled>
      <Fieldset.Legend>
        <label>
          <input type="checkbox" /> Select all
        </label>
      </Fieldset.Legend>
      <label>
        <input type="checkbox" /> News
      </label>
      <label>
        <input type="checkbox" /> Offers
      </label>
    </Fieldset.Root>
  )
}

export function InvalidStory() {
  return (
    <Fieldset.Root invalid>
      <Fieldset.Legend>Delivery speed</Fieldset.Legend>
      <label>
        <input type="radio" name="speed-invalid" /> Standard
      </label>
      <label>
        <input type="radio" name="speed-invalid" /> Express
      </label>
      <Fieldset.ErrorMessage>Choose a delivery speed.</Fieldset.ErrorMessage>
    </Fieldset.Root>
  )
}

/** Another tag for the legend: the group is then named through `aria-labelledby`. */
export function SubstitutedLegend() {
  return (
    <Fieldset.Root>
      <Fieldset.Legend render={<div />}>Billing address</Fieldset.Legend>
      <label>
        Street <input type="text" />
      </label>
    </Fieldset.Root>
  )
}

export function Danger() {
  return (
    <Fieldset.Root invalid data-tone="danger">
      <Fieldset.Legend>Payment</Fieldset.Legend>
      <label>
        Card <input type="text" />
      </label>
      <Fieldset.ErrorMessage>The card was declined.</Fieldset.ErrorMessage>
    </Fieldset.Root>
  )
}

export const variants: Variants = {
  AddressGroup: { title: "Address group", hidden: true },
  RadioSet: { title: "Radio set", hidden: true },
  DisabledStory: { title: "Disabled", hidden: true },
  NestedDisabled: { title: "Nested disabled", hidden: true },
  LegendWithSelectAll: { title: "Legend with select all", hidden: true },
  InvalidStory: { title: "Invalid", hidden: true },
  SubstitutedLegend: { title: "Substituted legend", hidden: true },
  Danger: { title: "Danger", hidden: true },
}
