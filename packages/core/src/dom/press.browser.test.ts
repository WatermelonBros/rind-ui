// Press without focus with real input: only a trusted mousedown moves focus.
import { afterEach, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { domEnvironment } from "../env/dom-environment"
import { createPress } from "./press"

afterEach(() => {
  document.body.innerHTML = ""
})

it("a stepper button declared not to take focus activates while focus stays in the input", async () => {
  document.body.innerHTML =
    '<input aria-label="Quantity" value="1"><button type="button" aria-label="Increment">+</button>'
  const input = document.querySelector("input") as HTMLInputElement
  const button = document.querySelector("button") as HTMLButtonElement
  const presses: string[] = []
  const press = createPress({
    env: domEnvironment(),
    send: (e) => presses.push(e.type),
    focusOnPress: false,
  })
  for (const [name, type] of [
    ["onPointerDown", "pointerdown"],
    ["onPointerUp", "pointerup"],
    ["onMouseDown", "mousedown"],
    ["onClick", "click"],
  ] as const) {
    // The handlers take structural event types the DOM events satisfy.
    button.addEventListener(type, press.props[name] as unknown as EventListener)
  }
  input.focus()
  await userEvent.click(button)
  expect(presses).toContain("PRESS")
  expect(document.activeElement).toBe(input)
})
