// The page text-field-password.pw.test.ts drives: a themed password Text Field in a form.
import { TextField } from "@rind-ui/react"
import { createRoot } from "react-dom/client"
import { LabelledFields } from "./labels"

function App() {
  return (
    <form
      style={{ display: "grid", gap: 16, width: 320, padding: 24 }}
      onSubmit={(e) => {
        e.preventDefault()
        // What the browser would send: the type must already be "password" here.
        const input = e.currentTarget.elements.namedItem("password") as HTMLInputElement
        document.body.dataset["typeAtSubmit"] = input.type
      }}
    >
      <TextField.Root type="password" name="password">
        <TextField.Label>Password</TextField.Label>
        <TextField.Input />
        <TextField.VisibilityTrigger>
          <TextField.VisibilityIndicator />
        </TextField.VisibilityTrigger>
      </TextField.Root>
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
      <LabelledFields />
    </form>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
