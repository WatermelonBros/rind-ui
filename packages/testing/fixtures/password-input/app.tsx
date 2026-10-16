// The page password-input.pw.test.ts drives: a themed Password Input in a form.
import { PasswordInput } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

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
      <PasswordInput.Root name="password">
        <PasswordInput.Label>Password</PasswordInput.Label>
        <PasswordInput.Input />
        <PasswordInput.VisibilityTrigger>
          <PasswordInput.Indicator />
        </PasswordInput.VisibilityTrigger>
      </PasswordInput.Root>
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
    </form>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
