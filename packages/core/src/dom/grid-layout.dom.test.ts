// Spatial navigation in a wrapped grid (collection-grid "Spatial Navigation"): layout only, so
// real browsers only.
import { afterEach, describe, expect, it } from "vitest"
import { spatialTarget } from "./grid-layout"

const inBrowser = !navigator.userAgent.includes("jsdom")

afterEach(() => {
  document.body.innerHTML = ""
})

/** Six 100 px cards, three per row. */
function cards() {
  document.body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,100px)">${[
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
  ]
    .map((k) => `<div data-key="${k}" style="height:50px"></div>`)
    .join("")}</div>`
  return [...document.querySelectorAll("[data-key]")]
}

describe.runIf(inBrowser)("spatialTarget", () => {
  it("moves to the card above or below", () => {
    const items = cards()
    expect(spatialTarget(items, "b", "down")).toBe("e")
    expect(spatialTarget(items, "e", "up")).toBe("b")
  })

  it("stays on an edge row instead of moving sideways in collection order", () => {
    const items = cards()
    expect(spatialTarget(items, "b", "up")).toBe("b")
    expect(spatialTarget(items, "e", "down")).toBe("e")
  })
})

it("null when nothing can be measured", () => {
  const el = document.createElement("div")
  el.setAttribute("data-key", "a")
  expect(spatialTarget([el], "a", "down")).toBe(null)
})
