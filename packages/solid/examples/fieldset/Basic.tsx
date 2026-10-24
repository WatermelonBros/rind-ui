/** @jsxImportSource solid-js */
import { Fieldset, TextField } from "@rind-ui/solid"

export function Basic() {
  return (
    <Fieldset.Root>
      <Fieldset.Legend>Shipping address</Fieldset.Legend>
      <Fieldset.Description>All fields are required.</Fieldset.Description>
      <div class="stack">
        <TextField.Root name="street" required>
          <TextField.Label>Street</TextField.Label>
          <TextField.Input />
        </TextField.Root>
        <TextField.Root name="city" required>
          <TextField.Label>City</TextField.Label>
          <TextField.Input />
        </TextField.Root>
      </div>
    </Fieldset.Root>
  )
}
