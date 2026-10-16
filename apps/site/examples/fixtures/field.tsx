"use client"

// Ported from apps/storybook/stories/Field.stories.tsx
import { Button, Field, Fieldset } from "@rind-ui/react"
import { FieldInput } from "../../../../packages/testing/fixtures/field/field-input"
import type { States, Variants } from "../types"

export const states: States = {
  field: { idle: "Idle", valid: "Valid", invalid: "Invalid" },
}

const form = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const

/** No Text Field yet: the fixture control implements the field-control contract. */
export function WithDescriptionAndError() {
  return (
    <form style={form}>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.Description>We never share it.</Field.Description>
        <Field.ErrorMessage />
      </Field.Root>
      <Button type="submit">Send</Button>
    </form>
  )
}

/** Errors appear when the form is submitted, and clear as soon as the value is fixed. */
export function Submit() {
  return (
    <form style={form}>
      <Field.Root validationMode="submit">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage />
      </Field.Root>
      <Button type="submit">Send</Button>
    </form>
  )
}

/** Errors appear when the control loses focus. */
export function Blur() {
  return (
    <form style={form}>
      <Field.Root validationMode="blur">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage />
      </Field.Root>
      <Button>Next</Button>
    </form>
  )
}

/** Errors appear as the user types. */
export function Change() {
  return (
    <form style={form}>
      <Field.Root validationMode="change">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage />
      </Field.Root>
    </form>
  )
}

/** `aria` behaviour: no native bubble, the control only gets `aria-invalid`. */
export function AriaBehavior() {
  return (
    <form style={form}>
      <Field.Root validationBehavior="aria">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage />
      </Field.Root>
      <Button type="submit">Send</Button>
    </form>
  )
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Type "taken": the check takes 500 ms (`data-validating`), then the error shows. */
export function AsyncValidate() {
  return (
    <form style={form}>
      <Field.Root
        validationMode="change"
        validate={async (value) => {
          await wait(500)
          return value === "taken" ? "That username is taken." : null
        }}
      >
        <Field.Label>Username</Field.Label>
        <FieldInput />
        <Field.Description>Try "taken".</Field.Description>
        <Field.ErrorMessage />
      </Field.Root>
    </form>
  )
}

/** One message per constraint: `match` picks the validity key behind the error. */
export function MatchMessages() {
  return (
    <form style={form}>
      <Field.Root validationMode="change">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage match="valueMissing">Enter your email.</Field.ErrorMessage>
        <Field.ErrorMessage match="typeMismatch">That is not an email address.</Field.ErrorMessage>
      </Field.Root>
    </form>
  )
}

export function Disabled() {
  return (
    <Field.Root disabled>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" defaultValue="ada@example.com" />
      <Field.Description>Managed by your administrator.</Field.Description>
    </Field.Root>
  )
}

export function ReadOnly() {
  return (
    <Field.Root readOnly>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" defaultValue="ada@example.com" />
    </Field.Root>
  )
}

export function Required() {
  return (
    <Field.Root required>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" />
      <Field.Description>Required.</Field.Description>
    </Field.Root>
  )
}

export function InsideDisabledFieldset() {
  return (
    <Fieldset.Root disabled>
      <Fieldset.Legend>Contact</Fieldset.Legend>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" />
        <Field.Description>Locked with the group.</Field.Description>
      </Field.Root>
    </Fieldset.Root>
  )
}

/** Without an ErrorMessage part the browser's own bubble reports the error. */
export function NoErrorMessage() {
  return (
    <form style={form}>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
      </Field.Root>
      <Button type="submit">Send</Button>
    </form>
  )
}

export function Idle() {
  return (
    <Field.Root>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" />
      <Field.Description>We never share it.</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  )
}

export function Valid() {
  return (
    <Field.Root invalid={false}>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" defaultValue="ada@example.com" />
      <Field.Description>We never share it.</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  )
}

export function Invalid() {
  return (
    <Field.Root invalid>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" defaultValue="abc" />
      <Field.Description>We never share it.</Field.Description>
      <Field.ErrorMessage>Enter a valid email address.</Field.ErrorMessage>
    </Field.Root>
  )
}

export const variants: Variants = {
  WithDescriptionAndError: { title: "With description and error", hidden: true },
  Submit: { title: "Submit", hidden: true },
  Blur: { title: "Blur", hidden: true },
  Change: { title: "Change", hidden: true },
  AriaBehavior: { title: "Aria behavior", hidden: true },
  AsyncValidate: { title: "Async validate", hidden: true },
  MatchMessages: { title: "Match messages", hidden: true },
  Disabled: { title: "Disabled", hidden: true },
  ReadOnly: { title: "Read only", hidden: true },
  Required: { title: "Required", hidden: true },
  InsideDisabledFieldset: { title: "Inside disabled fieldset", hidden: true },
  NoErrorMessage: { title: "No error message", hidden: true },
  Idle: { title: "Idle", hidden: true },
  Valid: { title: "Valid", hidden: true },
  Invalid: { title: "Invalid", hidden: true },
}
