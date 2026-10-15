// R1.5 Label Activation: a click a label forwards to the part (jsdom and Chromium), through
// the DOM adapter so pointer events carry real coordinates.
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { domEnv } from "../../src/index"
import { CounterButton } from "./press.react"

function setup(labelActivation?: "focus" | "activate") {
  let presses = 0
  render(
    // biome-ignore lint/a11y/noLabelWithoutControl: the button is the label's control (descendant)
    <label>
      <span>Quantity</span>
      <CounterButton onPress={() => presses++} {...(labelActivation ? { labelActivation } : {})}>
        Add
      </CounterButton>
    </label>,
  )
  const env = domEnv().create({ scope: "counter", anchor: { role: "button" }, modality: "pointer" })
  return {
    presses: () => presses,
    button: screen.getByRole("button"),
    clickLabel: () => env.find({ text: "Quantity" }).click(),
    clickButton: () => env.find({ role: "button" }).click(),
  }
}

describe("label activation", () => {
  it("default: a label click focuses the part and presses it exactly once", async () => {
    const { presses, button, clickLabel } = setup()
    await clickLabel()
    expect(document.activeElement).toBe(button)
    expect(presses()).toBe(1)
  })

  it('"focus": a label click focuses the part and sends no press (radix#3679, headlessui#3787)', async () => {
    const { presses, button, clickLabel } = setup("focus")
    await clickLabel()
    expect(document.activeElement).toBe(button)
    expect(presses()).toBe(0)
  })

  it.each([
    [undefined, 1],
    ["focus", 0],
  ] as const)("a consumer <label for> with %s: %i press(es), focused", async (mode, n) => {
    let presses = 0
    // The part derives its own id (element-ids): read it, then point the label at it.
    const ui = (htmlFor: string) => (
      <>
        <label htmlFor={htmlFor}>Quantity</label>
        <CounterButton onPress={() => presses++} {...(mode ? { labelActivation: mode } : {})}>
          Add
        </CounterButton>
      </>
    )
    const { rerender } = render(ui("none"))
    rerender(ui(screen.getByRole("button").id))
    const env = domEnv().create({
      scope: "counter",
      anchor: { role: "button" },
      modality: "pointer",
    })
    await env.find({ text: "Quantity" }).click()
    expect(document.activeElement).toBe(screen.getByRole("button"))
    expect(presses).toBe(n)
  })

  it.each([undefined, "focus"] as const)("direct click with %s: one press", async (mode) => {
    const { presses, clickButton } = setup(mode)
    await clickButton()
    expect(presses()).toBe(1)
  })

  it.each([
    [undefined, 1],
    ["focus", 0],
  ] as const)("virtual label click (AT, detail 0) with %s: %i press(es)", async (mode, n) => {
    const { presses, button } = setup(mode)
    await act(async () => {
      screen.getByText("Quantity").closest("label")?.click()
    })
    expect(document.activeElement).toBe(button)
    expect(presses()).toBe(n)
  })
})

describe("press-fixture variant: suppressTouchContextMenu (R2.3)", () => {
  it("a held touch on the stepper prevents the context menu and still counts one press", async () => {
    let presses = 0
    render(
      <CounterButton onPress={() => presses++} suppressTouchContextMenu>
        Step
      </CounterButton>,
    )
    const button = screen.getByRole("button")
    const touch = (type: string) =>
      button.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerType: "touch",
          pointerId: 3,
          width: 20,
          height: 20,
          pressure: 0.5,
        }),
      )
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    await act(async () => {
      touch("pointerdown")
      button.dispatchEvent(menu)
      touch("pointerup")
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }))
    })
    expect(menu.defaultPrevented).toBe(true)
    expect(presses).toBe(1)
  })
})
