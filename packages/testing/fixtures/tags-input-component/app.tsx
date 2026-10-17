// The page tags-input-component.pw.test.ts drives: public Tags Input, bundled by the test itself.
import { TagsInput } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

const win = window as unknown as { submits: number }
win.submits = 0

function Parts({ label }: { readonly label: string }) {
  return (
    <>
      <TagsInput.Label>{label}</TagsInput.Label>
      <TagsInput.Control>
        <TagsInput.Chips />
        <TagsInput.Input />
        <TagsInput.ClearTrigger />
      </TagsInput.Control>
    </>
  )
}

function App() {
  return (
    <div style={{ padding: 24, width: 320 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          win.submits += 1
        }}
      >
        <TagsInput.Root name="city">
          <Parts label="City" />
        </TagsInput.Root>
        <button type="submit">Submit</button>
      </form>
      <TagsInput.Root defaultValue={["rom", "paris"]}>
        <Parts label="Cities" />
      </TagsInput.Root>
      <div style={{ height: 3000 }} />
      <button type="button">After</button>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
