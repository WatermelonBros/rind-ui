// The page search-field.pw.test.ts drives: a themed Search Field in a form, and one in a Dialog.
import { Dialog, SearchField } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

type Log = { submits: string[]; form: string | null }
const log: Log = { submits: [], form: null }
Reflect.set(window, "__log", log)

function App() {
  return (
    <div style={{ display: "grid", gap: 24, width: 320, padding: 24 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          log.form = String(new FormData(e.currentTarget).get("q"))
        }}
      >
        <SearchField.Root name="q" onSubmit={(value) => log.submits.push(value)}>
          <SearchField.Label>Search books</SearchField.Label>
          <SearchField.Input />
          <SearchField.ClearTrigger />
        </SearchField.Root>
      </form>
      <Dialog.Root>
        <Dialog.Trigger>Find</Dialog.Trigger>
        <Dialog.Positioner style={{ position: "fixed", inset: 0 }}>
          <Dialog.Content>
            <Dialog.Title>Find</Dialog.Title>
            <SearchField.Root>
              <SearchField.Label>Search shelf</SearchField.Label>
              <SearchField.Input />
              <SearchField.ClearTrigger />
            </SearchField.Root>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
