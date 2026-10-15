// The anchored fixture through the driver: placed, then focused; jsdom and the browser.
import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { createDriver } from "../../src/index"
import { anchoredContract } from "./anchored.contract"
import { AnchoredExample } from "./anchored.react"

it("opens, is placed, moves focus in, and closes on Escape", async () => {
  render(<AnchoredExample label="Details" />)
  const a = createDriver(anchoredContract, screen, "Details").via("keyboard")
  await a.open()
  expect(await a.isPlaced()).toBe(true)
  expect(await a.side()).toBe("bottom")
  expect(await a.align()).toBe("center")
  await a.close()
  expect(await a.isOpen()).toBe(false)
})
