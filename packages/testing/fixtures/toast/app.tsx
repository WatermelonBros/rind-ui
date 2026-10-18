// The page toast.pw.test.ts drives: an input, a button that shows a toast, a store exposed on
// `window`, and (variant "dialog") a modal Dialog open under the toasts. The test picks the
// variant through `window.__variant`, bundled by the test.
import { createToaster, type Toaster as ToasterStore } from "@rind-ui/core"
import { Dialog, Toast, Toaster } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

declare global {
  interface Window {
    __variant?: "default" | "restricted" | "dialog"
    store: ToasterStore
  }
}

const variant = window.__variant ?? "default"
const store = createToaster(
  variant === "restricted" ? { swipeDirections: ["up", "right"] } : { duration: 60_000 },
)
window.store = store

function Region() {
  return (
    <Toaster toaster={store}>
      {(t) => (
        <Toast.Root>
          <Toast.Title />
          {t.data.action ? <Toast.ActionTrigger /> : null}
          <Toast.CloseTrigger>
            <svg aria-hidden="true" width="12" height="12" />
          </Toast.CloseTrigger>
        </Toast.Root>
      )}
    </Toaster>
  )
}

function App() {
  return (
    <>
      {variant === "dialog" ? (
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Content>
              <Dialog.Title>Settings</Dialog.Title>
              <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
      <input aria-label="Name" />
      <button type="button" onClick={() => store.show("Saved")}>
        Show saved
      </button>
      <Region />
    </>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
