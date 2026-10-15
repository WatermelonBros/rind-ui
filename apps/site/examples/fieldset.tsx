"use client"

import { Fieldset, TextField } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <Fieldset.Root>
      <Fieldset.Legend>Shipping address</Fieldset.Legend>
      <Fieldset.Description>All fields are required.</Fieldset.Description>
      <div className="stack">
        <TextField.Root name="street" required>
          <TextField.Label>Street</TextField.Label>
          <TextField.Input />
        </TextField.Root>
        <TextField.Root name="city" required>
          <TextField.Label>City</TextField.Label>
          <TextField.Input />
        </TextField.Root>
      </div>
    </Fieldset.Root>
  )
}

export function Disabled() {
  return (
    <Fieldset.Root disabled>
      <Fieldset.Legend>Billing address</Fieldset.Legend>
      <Fieldset.Description>
        Disabling the group disables every control inside.
      </Fieldset.Description>
      <div className="stack">
        <TextField.Root>
          <TextField.Label>Street</TextField.Label>
          <TextField.Input />
        </TextField.Root>
        <input className="native" aria-label="Notes" placeholder="A native input too" />
      </div>
    </Fieldset.Root>
  )
}

export function Invalid() {
  return (
    <Fieldset.Root invalid>
      <Fieldset.Legend>Shipping address</Fieldset.Legend>
      <div className="stack">
        <TextField.Root>
          <TextField.Label>Street</TextField.Label>
          <TextField.Input />
        </TextField.Root>
        <Fieldset.ErrorMessage>Enter a full address.</Fieldset.ErrorMessage>
      </div>
    </Fieldset.Root>
  )
}

export function Toggleable() {
  const [disabled, setDisabled] = useState(false)
  return (
    <div className="stack">
      <Fieldset.Root disabled={disabled}>
        <Fieldset.Legend>Contact</Fieldset.Legend>
        <TextField.Root>
          <TextField.Label>Email</TextField.Label>
          <TextField.Input />
        </TextField.Root>
      </Fieldset.Root>
      <button type="button" onClick={() => setDisabled(!disabled)}>
        {disabled ? "Enable" : "Disable"} the group
      </button>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  Disabled: {
    title: "Disabled",
    description: "`disabled` on the Root disables native and rind-ui controls alike.",
  },
  Invalid: {
    title: "Group error",
    description: "`invalid` renders `Fieldset.ErrorMessage`; it is not passed to the controls.",
  },
  Toggleable: { title: "Toggled", description: "`disabled` follows state." },
}
