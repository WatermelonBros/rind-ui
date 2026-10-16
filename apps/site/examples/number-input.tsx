"use client"

import { Button, Fieldset, NumberInput, type NumberInputRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/**
 * `composing`, `pressing` and `spinning` cannot be held by a static render (an IME session
 * or a held pointer): they are reached by the driver.
 */
export const states: States = { "number-input": { idle: "Basic" } }

/** Label, input and, optionally, the two steppers. */
function Field({
  label,
  triggers = true,
  ...props
}: NumberInputRootProps & { readonly label: string; readonly triggers?: boolean }) {
  return (
    <NumberInput.Root {...props}>
      <NumberInput.Label>{label}</NumberInput.Label>
      <NumberInput.Control>
        {triggers && <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>}
        <NumberInput.Input />
        {triggers && <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>}
      </NumberInput.Control>
    </NumberInput.Root>
  )
}

export function Basic() {
  return <Field label="Quantity" defaultValue={2} />
}

export function MinMaxStep() {
  return <Field label="Guests" defaultValue={4} min={1} max={20} step={1} />
}

export function DecimalStep() {
  return <Field label="Weight (kg)" defaultValue={1.5} step={0.1} min={0} />
}

export function Percent() {
  return <Field label="Discount" defaultValue={0.25} formatOptions={{ style: "percent" }} />
}

export function CurrencyGerman() {
  return (
    <Field
      label="Preis"
      defaultValue={1234.5}
      locale="de-DE"
      formatOptions={{ style: "currency", currency: "EUR" }}
    />
  )
}

export function Units() {
  return (
    <Field
      label="Speed"
      defaultValue={50}
      min={0}
      formatOptions={{ style: "unit", unit: "kilometer-per-hour" }}
    />
  )
}

export function ArabicDigits() {
  return <Field label="الكمية" defaultValue={12} locale="ar-EG" />
}

export function PersianDigits() {
  return <Field label="تعداد" defaultValue={12} locale="fa-IR" />
}

export function ValidateInField() {
  return (
    <NumberInput.Root
      name="seats"
      max={100}
      defaultValue={120}
      commitBehavior="validate"
      validationMode="change"
    >
      <NumberInput.Label>Seats (max 100)</NumberInput.Label>
      <NumberInput.Control>
        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
        <NumberInput.Input />
        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
      </NumberInput.Control>
      <NumberInput.Description>
        Typing keeps your number; it is checked on commit.
      </NumberInput.Description>
      <NumberInput.ErrorMessage />
    </NumberInput.Root>
  )
}

export function Wheel() {
  return <Field label="Scroll me (focus first)" defaultValue={5} allowWheel triggers={false} />
}

export function NoHold() {
  return <Field label="Tap only" defaultValue={0} spinOnPress={false} />
}

export function ControlledClamp() {
  const [value, setValue] = useState<number | null>(5)
  return (
    <div className="stack">
      <Field
        label="Capped at 10 by the parent"
        value={value}
        onValueChange={(v) => setValue(v === null ? null : Math.min(v, 10))}
      />
      <span className="note">value: {value ?? "empty"}</span>
    </div>
  )
}

export function ReadOnly() {
  return <Field label="Read-only" defaultValue={7} readOnly />
}

export function Disabled() {
  return <Field label="Disabled" defaultValue={7} disabled />
}

export function InFieldAndFieldset() {
  return (
    <Fieldset.Root>
      <Fieldset.Legend>Order</Fieldset.Legend>
      <Fieldset.Description>Disabling the group disables both counters.</Fieldset.Description>
      <div className="stack">
        <Field label="Adults" name="adults" defaultValue={2} min={1} required />
        <Field label="Children" name="children" defaultValue={0} min={0} />
      </div>
    </Fieldset.Root>
  )
}

export function ReadoSettingsRecipe() {
  const [committed, setCommitted] = useState<number | null>(14)
  return (
    <div className="stack">
      <Field
        label="Editor font size"
        defaultValue={14}
        min={8}
        max={32}
        formatOptions={{ style: "unit", unit: "pixel" }}
        onValueCommit={setCommitted}
      />
      <span className="note">last committed: {committed ?? "empty"}</span>
      <Button type="button" onClick={() => setCommitted(14)}>
        Forget
      </Button>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "Steppers and keys move by 1; typing commits on blur or Enter.",
  },
  MinMaxStep: {
    title: "Min, max and step",
    description: "A stepper turns `aria-disabled` at a bound.",
  },
  DecimalStep: { title: "Decimal step", description: "`step={0.1}` without float drift." },
  Percent: {
    title: "Percent",
    description: "The value is a fraction (0.25) shown as 25%; the step is 1%.",
  },
  CurrencyGerman: {
    title: "Currency, German",
    description: '`locale="de-DE"` with EUR: "1.234,50 €".',
  },
  Units: { title: "Units", description: '`style: "unit"` parses and formats the unit text.' },
  ArabicDigits: {
    title: "Arabic digits",
    description: '`locale="ar-EG"`; any numbering system is accepted.',
  },
  PersianDigits: { title: "Persian digits", description: '`locale="fa-IR"`.' },
  ValidateInField: {
    title: "Validate in a Field",
    description: '`commitBehavior="validate"` keeps 120 and reports it through the Field.',
  },
  Wheel: {
    title: "Wheel",
    description: "`allowWheel` steps the focused input on a vertical wheel.",
  },
  NoHold: { title: "No press-and-hold", description: "`spinOnPress={false}`: one step per press." },
  ControlledClamp: { title: "Controlled", description: "The parent caps the value at 10." },
  ReadOnly: { title: "Read-only", description: "Focusable and submitted, ignores changes." },
  Disabled: { title: "Disabled", description: "Ignores all input." },
  InFieldAndFieldset: {
    title: "Field and Fieldset",
    description: "Names, required and disabled flow from the group.",
  },
  ReadoSettingsRecipe: {
    title: "Settings recipe",
    description: "Save on `onValueCommit`: once per interaction, not per keystroke or repeat.",
  },
}
