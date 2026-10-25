/** @jsxImportSource solid-js */
import { Field, TextField } from "@rind-ui/solid"

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
