/** @jsxImportSource solid-js */
import { NumberInput } from "@rind-ui/solid"

export function Basic() {
  return (
    <NumberInput.Root defaultValue={2}>
      <NumberInput.Label>Quantity</NumberInput.Label>
      <NumberInput.Control>
        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
        <NumberInput.Input />
        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
      </NumberInput.Control>
    </NumberInput.Root>
  )
}
