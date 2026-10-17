// Model-based tests (task 6.2): the toaster region's contract (collapsed / expanded) over
// every mapped transition in pointer, keyboard and virtual, with axe per state. Its toasts
// never time out here, so the region stays for the whole path.
import { createToaster, toasterContract } from "@rind-ui/core"
import { Toast, Toaster } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

describe("toaster model", () => {
  testMachine(toasterContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () => {
      const store = createToaster({ duration: Number.POSITIVE_INFINITY })
      store.show({ title: "Saved", description: "3 files" })
      store.show({ title: "Archived" })
      return render(
        <>
          <input aria-label="Name" />
          <Toaster toaster={store}>
            {() => (
              <Toast.Root>
                <Toast.Title />
                <Toast.CloseTrigger>Dismiss</Toast.CloseTrigger>
              </Toast.Root>
            )}
          </Toaster>
        </>,
      )
    },
    target: () => screen,
    anchor: [{ name: "Notifications (F6)" }] as never,
    props: { expand: false } as never,
    modalities: ["pointer", "keyboard", "virtual"],
    a11y,
  })
})
