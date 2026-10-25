/** @jsxImportSource solid-js */
import { TextField } from "@rind-ui/solid"

export function Basic() {
  return (
    <TextField.Root name="handle" required>
      <TextField.Label>Handle</TextField.Label>
      <TextField.Input placeholder="@you" maxLength={20} />
      <TextField.Description>Up to 20 characters.</TextField.Description>
      <TextField.ErrorMessage />
    </TextField.Root>
  )
}
