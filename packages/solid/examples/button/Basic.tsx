/** @jsxImportSource solid-js */
import { Button } from "@rind-ui/solid"
import { createSignal } from "solid-js"

export function Basic() {
  const [pending, setPending] = createSignal(false)
  const [count, setCount] = createSignal(0)
  return (
    <div class="row">
      <Button onPress={() => setCount((c) => c + 1)}>Pressed {count()}×</Button>
      <Button
        pending={pending()}
        onPress={() => {
          setPending(true)
          setTimeout(() => setPending(false), 1500)
        }}
      >
        {pending() ? "Saving…" : "Save"}
      </Button>
      <Button disabled>Disabled</Button>
    </div>
  )
}
