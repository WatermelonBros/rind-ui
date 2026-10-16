// The page number-input.pw.test.ts drives: themed Number Inputs, bundled by the test itself.
import { NumberInput, type NumberInputRootProps } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

function N({ label, ...props }: NumberInputRootProps & { label: string }) {
  return (
    <NumberInput.Root {...props}>
      <NumberInput.Label>{label}</NumberInput.Label>
      <NumberInput.Control>
        <NumberInput.DecrementTrigger />
        <NumberInput.Input />
        <NumberInput.IncrementTrigger />
      </NumberInput.Control>
    </NumberInput.Root>
  )
}

function App() {
  return (
    <form style={{ display: "grid", gap: 16, width: 280, padding: 24 }}>
      <N label="Quantity" name="q" defaultValue={0} />
      <N
        label="Price"
        name="price"
        defaultValue={9}
        locale="de-DE"
        formatOptions={{ style: "currency", currency: "EUR" }}
      />
      <N label="Limit" name="limit" defaultValue={9} max={10} />
      <button type="reset">Reset</button>
    </form>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
