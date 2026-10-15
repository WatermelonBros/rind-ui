"use client"

import { Button, Field, Form, RindProvider, TextField } from "@rind-ui/react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <RindProvider
      locale="it-IT"
      messages={{ field: { valueMissing: "Campo obbligatorio", typeMismatch: "Email non valida" } }}
    >
      <Form.Root aria-label="Iscrizione">
        <div className="stack">
          <Field.Root name="email" required>
            <Field.Label>Email</Field.Label>
            <TextField.Root>
              <TextField.Input type="email" />
            </TextField.Root>
            <Field.ErrorMessage />
          </Field.Root>
          <Button type="submit">Iscriviti</Button>
        </div>
      </Form.Root>
    </RindProvider>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Messages per locale",
    description:
      "Submit empty, then type “abc”: the Field's messages come from the provider, in Italian.",
  },
}
