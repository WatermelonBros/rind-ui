"use client"

import { Button, Field, TextField } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <Field.Root name="email" required>
      <Field.Label>Email</Field.Label>
      <TextField.Root>
        <TextField.Input type="email" placeholder="you@example.com" />
      </TextField.Root>
      <Field.Description>We never share it.</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  )
}

export function CustomValidation() {
  return (
    <Field.Root
      name="username"
      validationMode="change"
      validate={(value) => (String(value).includes(" ") ? "No spaces allowed." : null)}
    >
      <Field.Label>Username</Field.Label>
      <TextField.Root>
        <TextField.Input placeholder="ada" />
      </TextField.Root>
      <Field.Description>Type a space to see the error.</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  )
}

export function AsyncValidation() {
  return (
    <Field.Root
      name="handle"
      validationMode="change"
      validationDebounce={300}
      validate={async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return value === "taken" ? "That handle is taken." : null
      }}
    >
      <Field.Label>Handle</Field.Label>
      <TextField.Root>
        <TextField.Input placeholder="ada" />
      </TextField.Root>
      <Field.Description>Try "taken".</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  )
}

export function ValidateOnBlur() {
  return (
    <Field.Root name="email" required validationMode="blur">
      <Field.Label>Email</Field.Label>
      <TextField.Root>
        <TextField.Input type="email" />
      </TextField.Root>
      <Field.Description>Validated when focus leaves.</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  )
}

export function MatchedMessages() {
  return (
    <Field.Root name="email" required validationMode="change">
      <Field.Label>Email</Field.Label>
      <TextField.Root>
        <TextField.Input type="email" />
      </TextField.Root>
      <Field.ErrorMessage match="valueMissing">Email is required.</Field.ErrorMessage>
      <Field.ErrorMessage match="typeMismatch">That is not an email address.</Field.ErrorMessage>
    </Field.Root>
  )
}

export function ServerErrors() {
  const [errors, setErrors] = useState<string[]>([])
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault()
        setErrors(["That email is already registered."])
      }}
    >
      <Field.Root name="email" errors={errors}>
        <Field.Label>Email</Field.Label>
        <TextField.Root defaultValue="ada@example.com">
          <TextField.Input type="email" />
        </TextField.Root>
        <Field.ErrorMessage />
      </Field.Root>
      <div>
        <Button type="submit">Sign up</Button>
      </div>
    </form>
  )
}

export function DisabledAndReadOnly() {
  return (
    <div className="stack">
      <Field.Root name="plan" disabled>
        <Field.Label>Plan</Field.Label>
        <TextField.Root defaultValue="Pro">
          <TextField.Input />
        </TextField.Root>
      </Field.Root>
      <Field.Root name="id" readOnly>
        <Field.Label>Account ID</Field.Label>
        <TextField.Root defaultValue="acct_1024">
          <TextField.Input />
        </TextField.Root>
        <Field.Description>Read-only, but still submitted.</Field.Description>
      </Field.Root>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  CustomValidation: {
    title: "Custom validation",
    description:
      '`validate` runs after native constraints pass; `validationMode="change"` shows it while typing.',
  },
  AsyncValidation: {
    title: "Async validation",
    description:
      "A promise from `validate` sets `data-validating`; `validationDebounce` waits for a typing pause.",
  },
  ValidateOnBlur: {
    title: "Validation mode",
    description: '`validationMode="blur"` displays errors when focus leaves the control.',
  },
  MatchedMessages: {
    title: "Per-constraint messages",
    description: "`match` renders an ErrorMessage only for one validity key.",
  },
  ServerErrors: {
    title: "Server errors",
    description: "`errors` shows messages from the server at once; the next change clears them.",
  },
  DisabledAndReadOnly: {
    title: "Disabled and read-only",
    description: "`disabled` and `readOnly` reach the control through the Field.",
  },
}
