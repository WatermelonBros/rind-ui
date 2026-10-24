/** @jsxImportSource solid-js */
import { PinInput } from "@rind-ui/solid"
import { For } from "solid-js"

export function SixDigit() {
  return (
    <PinInput.Root length={6}>
      <PinInput.Label>Verification code</PinInput.Label>
      <PinInput.Control>
        <PinInput.Input />
        <For each={[0, 1, 2, 3, 4, 5]}>{(i) => <PinInput.Slot index={i} />}</For>
      </PinInput.Control>
    </PinInput.Root>
  )
}
