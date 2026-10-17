"use client"

import { mergeFieldProps } from "@rind-ui/core"
import { Field, useFieldControl } from "@rind-ui/react"
import { useId, useLayoutEffect, useRef, useState } from "react"
import type { Variants } from "./types"

/** A control written outside rind-ui: a plain input that upper-cases a postcode as you type. */
function PostcodeInput({ placeholder }: { readonly placeholder?: string }) {
  const binding = useFieldControl()
  const ownId = useId()
  const id = binding?.controlId ?? ownId
  const el = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const field = mergeFieldProps({ role: "textbox", labelable: true }, binding)
  useLayoutEffect(
    () =>
      binding?.register(
        {
          id,
          labelable: true,
          focus: () => el.current?.focus(),
          validityElement: () => el.current,
          value: () => el.current?.value ?? "",
        },
        "Postcode",
      ),
    [binding?.register, id],
  )
  return (
    <input
      {...binding?.data}
      ref={el}
      id={id}
      className="native"
      value={value}
      placeholder={placeholder}
      disabled={field.disabled}
      readOnly={field.readOnly}
      required={field.required}
      name={field.name}
      aria-invalid={field["aria-invalid"]}
      aria-describedby={field["aria-describedby"]}
      aria-labelledby={field["aria-labelledby"]}
      pattern="[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}"
      onChange={(e) => {
        const next = e.currentTarget.value.toUpperCase()
        setValue(next)
        binding?.report({ type: "change", value: next, user: true, composing: false })
      }}
      onBlur={() => binding?.report({ type: "commit" })}
    />
  )
}

export function Basic() {
  return (
    <Field.Root name="postcode" required validationMode="blur">
      <Field.Label>Postcode</Field.Label>
      <PostcodeInput placeholder="SW1A 1AA" />
      <Field.Description>Your own input, labelled and validated by the Field.</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  )
}

export function Disabled() {
  return (
    <Field.Root name="postcode" disabled>
      <Field.Label>Postcode</Field.Label>
      <PostcodeInput placeholder="SW1A 1AA" />
    </Field.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "A custom control in a Field",
    description:
      "Type a wrong postcode and Tab away: the Field shows its error and the input gets aria-invalid.",
  },
  Disabled: {
    title: "Disabled by the Field",
    description: "The Field's disabled reaches the custom input; no prop on the input itself.",
  },
}
