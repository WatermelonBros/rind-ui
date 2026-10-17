// Model-based tests (task 6.2): one toast's contract over every mapped transition in pointer,
// keyboard, touch and virtual, both directions, with the timed and presence invariants and
// axe per state. The lifetime runs on a virtual clock.
import { createToaster, toastContract } from "@rind-ui/core"
import { RindProvider, Toast, Toaster } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { testMachine, virtualClock } from "../index"

const clock = virtualClock()

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const DATA = {
  id: "saved",
  type: "info",
  title: "Saved",
  description: "3 files",
  action: { label: "Undo", onAction: () => {}, closes: true },
  duration: 3000,
} as const

function Example() {
  const store = createToaster({ duration: 3000 })
  store.show(DATA)
  return (
    <RindProvider environment={{ scheduler: clock.scheduler }}>
      <input aria-label="Name" />
      <Toaster toaster={store}>
        {() => (
          <Toast.Root>
            <Toast.Title />
            <Toast.Description />
            <Toast.ActionTrigger />
            <Toast.CloseTrigger>Dismiss</Toast.CloseTrigger>
          </Toast.Root>
        )}
      </Toaster>
    </RindProvider>
  )
}

describe("toast model", () => {
  testMachine(toastContract, {
    test: it,
    setup: () => render(<Example />),
    target: () => screen,
    anchor: [{ name: "Saved" }] as never,
    props: {
      data: { ...DATA },
      duration: 3000,
      swipeDirections: [],
      hotkey: "F6",
    } as never,
    modalities: ["pointer", "keyboard", "touch", "virtual"],
    clock,
    a11y,
  })
})
