// The layer fixture's driver test: the same scenario in jsdom and the browser.
import { render, screen } from "@testing-library/react"
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
