// The page pin-input.pw.test.ts drives: Pin Inputs in a form, bundled by the test itself.
import { Field, PinInput, type PinInputRootProps } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

// Inline row layout, independent of the theme: slots side by side (presses map by geometry).
function Row({ length }: { length: number }) {
  return (
    <PinInput.Control style={{ display: "flex", gap: 4 }}>
      <PinInput.Input />
      {Array.from({ length }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: slots are positions
        <PinInput.Slot key={i} index={i} style={{ width: 40, height: 40, pointerEvents: "none" }} />
      ))}
    </PinInput.Control>
  )
}

function Pin({ label, ...props }: PinInputRootProps & { label: string }) {
  return (
    <PinInput.Root {...props}>
      <PinInput.Label>{label}</PinInput.Label>
      <Row length={props.length} />
    </PinInput.Root>
  )
}

function App() {
  return (
    <form
      style={{ display: "grid", gap: 16, width: 320, padding: 24 }}
      onSubmit={(e) => {
        e.preventDefault()
        const d = document.body.dataset
        d["submits"] = String(Number(d["submits"] ?? 0) + 1)
      }}
    >
      <label>
        Email
        <input type="email" name="email" required />
      </label>
      <Pin label="Verification code" name="code" length={6} autoSubmit />
      <Field.Root name="backup" required>
        <Field.Label>Backup code</Field.Label>
        <PinInput.Root length={6}>
          <Row length={6} />
        </PinInput.Root>
        <Field.ErrorMessage />
      </Field.Root>
      <Pin label="PIN" length={4} mask />
      <button type="submit">Send</button>
      <button type="reset">Reset</button>
    </form>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
