// The layer fixture's driver test: the same scenario in jsdom and the browser.
import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { createDriver } from "../../src/index"
import { layerContract } from "./layer.contract"
import { LayerExample } from "./layer.fixture"

it("opens modal, focuses inside, hides the outside, closes on Escape and restores focus", async () => {
  render(
    <div id="app">
      <LayerExample label="Settings" />
    </div>,
  )
  const layer = createDriver(layerContract, screen, "Settings").via("keyboard")
  await layer.open()
  expect(await layer.isOpen()).toBe(true)
  await layer.tab()
  expect(await layer.hasFocus()).toBe(true)
  // The sibling of the portal host on the path from <body> is marked (here: the container).
  expect(document.getElementById("app")?.closest("[inert]")).not.toBeNull()
  expect(document.documentElement.hasAttribute("data-rind-scroll-locked")).toBe(true)
  await layer.pressEscape()
  expect(await layer.isOpen()).toBe(false)
  expect(document.getElementById("app")?.closest("[inert]")).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Settings" }))
})

it("a non-modal layer's trigger toggles it closed (a trigger press is not outside)", async () => {
  render(<LayerExample label="Filters" modal={false} />)
  const layer = createDriver(layerContract, screen, "Filters").via("pointer")
  await layer.open()
  const trigger = screen.getByRole("button", { name: "Filters" })
  // The pointer sequence of a real press: an outside pointerdown would close it first and
  // the click would then reopen it.
  fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 })
  fireEvent.pointerUp(trigger, { pointerType: "mouse", button: 0 })
  fireEvent.click(trigger, { detail: 1 })
  expect(await layer.isOpen()).toBe(false)
})

it("a modal menu keeps its registered trigger exposed and is named by it (RA#9737)", async () => {
  render(
    <div id="app">
      <p id="other">Elsewhere</p>
      <LayerExample label="Actions" kind="menu" />
    </div>,
  )
  const layer = createDriver(layerContract, screen, "Actions").via("keyboard")
  await layer.open()
  const trigger = screen.getByRole("button", { name: "Actions" })
  expect(trigger.closest("[inert]")).toBeNull()
  expect(document.getElementById("other")?.closest("[inert]")).not.toBeNull()
  expect(screen.getByRole("dialog", { name: "Actions" })).toBeTruthy()
  fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 })
  fireEvent.pointerUp(trigger, { pointerType: "mouse", button: 0 })
  fireEvent.click(trigger, { detail: 1 })
  expect(await layer.isOpen()).toBe(false)
})
