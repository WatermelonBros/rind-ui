"use client"

import { Button, Field, Form, TextField } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  const [sent, setSent] = useState<string | null>(null)
  return (
    <Form.Root
      aria-label="Sign up"
      onFormSubmit={(values) => setSent(String(values["email"] ?? ""))}
    >
      <div className="stack">
        <Field.Root name="email" required>
          <Field.Label>Email</Field.Label>
          <TextField.Root>
            <TextField.Input type="email" />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <div className="row">
          <Button type="submit">Sign up</Button>
          {sent !== null && <span className="note">Signed up {sent}</span>}
        </div>
      </div>
    </Form.Root>
  )
}

export function CrossFieldValidation() {
  return (
    <Form.Root aria-label="Choose a password">
      <div className="stack">
        <Field.Root name="password" required>
          <Field.Label>Password</Field.Label>
          <TextField.Root>
            <TextField.Input type="password" minLength={8} />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <Field.Root
          name="confirm"
          required
          validate={(value, values) =>
            value === values["password"] ? null : "Passwords do not match."
          }
        >
          <Field.Label>Confirm password</Field.Label>
          <TextField.Root>
            <TextField.Input type="password" />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <div>
          <Button type="submit">Save</Button>
        </div>
      </div>
    </Form.Root>
  )
}

export function ServerErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({})
  return (
    <Form.Root
      aria-label="Register"
      errors={errors}
      onFormSubmit={(values) => {
        setErrors(values["email"] === "taken@example.com" ? { email: "Already registered." } : {})
      }}
    >
      <div className="stack">
        <Field.Root name="email" required>
          <Field.Label>Email</Field.Label>
          <TextField.Root defaultValue="taken@example.com">
            <TextField.Input type="email" />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <div>
          <Button type="submit">Register</Button>
        </div>
      </div>
    </Form.Root>
  )
}

export function ValidationMode() {
  return (
    <Form.Root aria-label="Contact" validationMode="change">
      <div className="stack">
        <Field.Root name="name" required>
          <Field.Label>Name</Field.Label>
          <TextField.Root>
            <TextField.Input />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <Field.Root name="email" required>
          <Field.Label>Email</Field.Label>
          <TextField.Root>
            <TextField.Input type="email" />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <div>
          <Button type="submit">Send</Button>
        </div>
      </div>
    </Form.Root>
  )
}

export function ValidateAndReset() {
  return (
    <Form.Root aria-label="Profile" validationBehavior="aria">
      <div className="stack">
        <Field.Root name="name" required>
          <Field.Label>Name</Field.Label>
          <TextField.Root>
            <TextField.Input />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <div className="row">
          <Button type="submit">Save</Button>
          <Button type="reset">Reset</Button>
        </div>
      </div>
    </Form.Root>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  CrossFieldValidation: {
    title: "Cross-field validation",
    description: "A Field's `validate` receives every named value as its second argument.",
  },
  ServerErrors: {
    title: "Server errors",
    description: "`errors` maps Field names to messages; the Form focuses the first one.",
  },
  ValidationMode: {
    title: "Validation mode",
    description: "`validationMode` sets the default for every Field inside.",
  },
  ValidateAndReset: {
    title: "ARIA behavior and reset",
    description:
      '`validationBehavior="aria"` shows errors without the native bubble; reset clears them.',
  },
}
