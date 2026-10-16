"use client"

import { Button, PinInput, type PinInputRootProps } from "@rind-ui/react"
import { type ReactNode, useState } from "react"
import type { States, Variants } from "./types"

/** `composing` needs an IME session, so the driver reaches it. */
export const states: States = { "pin-input": { idle: "SixDigit" } }

type FieldProps = Omit<PinInputRootProps, "children" | "length"> & {
  readonly label: string
  readonly length?: number
  readonly children?: ReactNode
}

/** Label, one input and one presentational slot per position. */
function Code({ label, length = 6, children, ...props }: FieldProps) {
  return (
    <PinInput.Root length={length} {...props}>
      <PinInput.Label>{label}</PinInput.Label>
      <PinInput.Control>
        <PinInput.Input />
        {Array.from({ length }, (_, i) => `slot-${i}`).map((key, i) => (
          <PinInput.Slot key={key} index={i} />
        ))}
      </PinInput.Control>
      {children}
    </PinInput.Root>
  )
}

export function SixDigit() {
  return <Code label="Verification code" />
}

export function Grouped() {
  return (
    <PinInput.Root length={6}>
      <PinInput.Label>Grouped code</PinInput.Label>
      <PinInput.Control>
        <PinInput.Input />
        {[0, 1, 2].map((i) => (
          <PinInput.Slot key={i} index={i} />
        ))}
        <span data-part="separator" aria-hidden="true">
          –
        </span>
        {[3, 4, 5].map((i) => (
          <PinInput.Slot key={i} index={i} />
        ))}
      </PinInput.Control>
    </PinInput.Root>
  )
}

export function Alphanumeric() {
  return (
    <Code
      label="Invite code"
      length={6}
      validationType="alphanumeric"
      sanitize={(t) => t.toUpperCase()}
    />
  )
}

export function Masked() {
  return <Code label="PIN" length={4} mask autoComplete="off" />
}

export function AutoSubmit() {
  const [sent, setSent] = useState<string | null>(null)
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(String(new FormData(e.currentTarget).get("code") ?? ""))
      }}
    >
      <Code label="Code" name="code" autoSubmit />
      <span className="note">{sent === null ? "not submitted" : `submitted: ${sent}`}</span>
    </form>
  )
}

export function Controlled() {
  const [value, setValue] = useState<string | undefined>("123")
  return (
    <div className="stack">
      <Code label="Controlled code" value={value} onValueChange={setValue} />
      <span className="note">value: {value || "empty"}</span>
      <Button type="button" onClick={() => setValue(undefined)}>
        Clear
      </Button>
    </div>
  )
}

export function ReadOnly() {
  return <Code label="Read-only code" defaultValue="482913" readOnly />
}

export function Disabled() {
  return <Code label="Disabled code" defaultValue="482913" disabled />
}

export function InvalidInField() {
  return (
    <Code label="Verification code" name="code" required invalid errors={["Enter the 6 digits."]}>
      <PinInput.Description>Sent by SMS.</PinInput.Description>
      <PinInput.ErrorMessage />
    </Code>
  )
}

export function Rtl() {
  return (
    <div dir="rtl">
      <Code label="رمز التحقق" dir="rtl" />
    </div>
  )
}

export const variants: Variants = {
  SixDigit: {
    title: "Six digits",
    description: "One native input over six slots; type, paste or autofill.",
  },
  Grouped: {
    title: "Grouped 3 + 3",
    description: 'A decorative `aria-hidden` `data-part="separator"` between two slots.',
  },
  Alphanumeric: {
    title: "Alphanumeric, uppercase",
    description: '`validationType="alphanumeric"` and `sanitize` uppercasing what is typed.',
  },
  Masked: {
    title: "Masked PIN",
    description: '`mask` hides the characters; `autoComplete="off"` keeps managers away.',
  },
  AutoSubmit: {
    title: "Auto-submit",
    description: "`autoSubmit` submits the form when a user change completes the code.",
  },
  Controlled: {
    title: "Controlled",
    description: "`value={undefined}` clears the input and every slot.",
  },
  ReadOnly: { title: "Read-only", description: "Focusable and submitted, ignores changes." },
  Disabled: { title: "Disabled", description: "Ignores all input." },
  InvalidInField: {
    title: "Invalid in a Field",
    description: "Required, with a description and an error message.",
  },
  Rtl: {
    title: "Right to left",
    description: "The slots keep their order inside an RTL page.",
  },
}
