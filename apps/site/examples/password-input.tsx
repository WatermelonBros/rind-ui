"use client"

import { Button, PasswordInput, type PasswordInputRootProps } from "@rind-ui/react"
import { type FormEvent, useState } from "react"
import type { States, Variants } from "./types"

/** `composing` needs an IME session: the driver reaches it. */
export const states: States = { "password-input": { idle: "Login" } }

/** Eye and crossed eye: CSS shows the one that matches the Indicator's `data-state`. */
function EyeIcons() {
  return (
    <PasswordInput.Indicator className="eye">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <title>Eye</title>
        <path className="eye-on" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle className="eye-on" cx="12" cy="12" r="3" />
        <path
          className="eye-off"
          d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.2-1"
        />
      </svg>
    </PasswordInput.Indicator>
  )
}

/** Label, input with the trigger inside its inline end. */
function Field({
  label,
  description,
  autoComplete,
  ...props
}: PasswordInputRootProps & {
  readonly label: string
  readonly description?: string
  readonly autoComplete?: string
}) {
  return (
    <PasswordInput.Root {...props}>
      <PasswordInput.Label>{label}</PasswordInput.Label>
      <div className="adorned">
        <PasswordInput.Input autoComplete={autoComplete} />
        <PasswordInput.VisibilityTrigger className="adorn-end">
          <EyeIcons />
        </PasswordInput.VisibilityTrigger>
      </div>
      {description && <PasswordInput.Description>{description}</PasswordInput.Description>}
      <PasswordInput.ErrorMessage />
    </PasswordInput.Root>
  )
}

export function Login() {
  return <Field label="Password" name="password" defaultValue="hunter2" />
}

export function SignUp() {
  return (
    <Field
      label="New password"
      name="new-password"
      autoComplete="new-password"
      description="At least 12 characters."
    />
  )
}

export function Controlled() {
  const [visible, setVisible] = useState(false)
  return (
    <div className="stack">
      <Field
        label="Password"
        defaultValue="correct horse"
        visible={visible}
        onVisibleChange={setVisible}
      />
      <span className="note">visible: {String(visible)}</span>
    </div>
  )
}

export function ReadOnly() {
  return <Field label="Recovery key" defaultValue="7f3a-91bc" readOnly />
}

export function Disabled() {
  return <Field label="Password" defaultValue="hunter2" disabled />
}

export function InvalidInField() {
  return (
    <Field
      label="Password"
      name="password"
      defaultValue="abc"
      invalid
      errors={["Use at least 12 characters."]}
    />
  )
}

export function HideOnSubmit() {
  const [submitted, setSubmitted] = useState(0)
  const [reason, setReason] = useState("none")
  return (
    <form
      className="stack"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        setSubmitted((n) => n + 1)
      }}
    >
      <Field
        label="Password"
        name="password"
        defaultValue="hunter2"
        defaultVisible
        onVisibleChange={(_, d) => setReason(d.reason)}
      />
      <div className="row">
        <Button type="submit">Sign in</Button>
        <Button type="reset">Reset</Button>
      </div>
      <span className="note">
        submitted: {submitted} · last hide reason: {reason}
      </span>
    </form>
  )
}

export function VaultUnlockRecipe() {
  const [state, setState] = useState("locked")
  return (
    <form
      className="stack"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        setState(data.get("master") === "open sesame" ? "unlocked" : "wrong password")
      }}
    >
      <Field
        label="Master password"
        name="master"
        autoComplete="off"
        description='Try "open sesame", then press Enter.'
      />
      <span className="note" role="status">
        vault: {state}
      </span>
    </form>
  )
}

export const variants: Variants = {
  Login: {
    title: "Login",
    description: "`autoComplete` defaults to `current-password`; the trigger is named once.",
  },
  SignUp: {
    title: "Sign up",
    description: '`autoComplete="new-password"` so a password manager offers to generate one.',
  },
  Controlled: { title: "Controlled visibility", description: "`visible` and `onVisibleChange`." },
  ReadOnly: { title: "Read-only", description: "The trigger still reveals the value." },
  Disabled: { title: "Disabled", description: "The trigger is disabled too." },
  InvalidInField: {
    title: "Invalid in a Field",
    description: "`invalid` and `errors` reach the input and the trigger.",
  },
  HideOnSubmit: {
    title: "Hidden on submit",
    description: "Starts revealed; a submit (even prevented) and a reset hide it.",
  },
  VaultUnlockRecipe: {
    title: "Vault unlock",
    description: "A password field alone in a form: Enter submits it.",
  },
}
