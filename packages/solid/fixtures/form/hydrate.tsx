/** @jsxImportSource solid-js */
import { Checkbox } from "../../src/checkbox"
import { CheckboxGroup } from "../../src/checkbox-group"
import { TextField } from "../../src/text-field"

export function App() {
  return (
    <form>
      <TextField.Root name="handle" required>
        <TextField.Label>Handle</TextField.Label>
        <TextField.Input />
        <TextField.Description>Hint</TextField.Description>
        <TextField.ErrorMessage />
      </TextField.Root>
      <Checkbox.Root name="tos" defaultChecked>
        <Checkbox.Control>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Control>
        <Checkbox.Label>Accept</Checkbox.Label>
      </Checkbox.Root>
      <CheckboxGroup.Root name="toppings" defaultValue={["a"]}>
        <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
        <CheckboxGroup.Item value="a">
          <CheckboxGroup.ItemControl />
          <CheckboxGroup.ItemLabel>Olives</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
        <CheckboxGroup.Item value="b">
          <CheckboxGroup.ItemControl />
          <CheckboxGroup.ItemLabel>Basil</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
      </CheckboxGroup.Root>
    </form>
  )
}
