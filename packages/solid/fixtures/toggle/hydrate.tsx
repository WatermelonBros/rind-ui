/** @jsxImportSource solid-js */
import { Toggle } from "../../src/toggle"

// Two toggles: each gets its own id from createUniqueId() on both sides.
export function App() {
  return (
    <>
      <Toggle.Root defaultPressed>Bold</Toggle.Root>
      <Toggle.Root>Italic</Toggle.Root>
    </>
  )
}
