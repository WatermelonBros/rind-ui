// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// Slider, Number Input and Rating on the server: the HTML is React's, hydrates with no
// warning, and the controls stay live (form values follow keys).
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

describe("Solid Slider, Number Input and Rating server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; values stay live", async () => {
    const server = await build("composite/controls.tsx", "ssr")
    const client = await build("composite/controls.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        "form",
        null,
        r(
          R.Slider.Root,
          { name: "v", defaultValue: [20, 80] },
          r(R.Slider.Label, null, "Volume"),
          r(R.Slider.ValueText),
          r(
            R.Slider.Control,
            null,
            r(R.Slider.Track, null, r(R.Slider.Indicator)),
            r(R.Slider.Thumb, { index: 0 }),
            r(R.Slider.Thumb, { index: 1 }),
          ),
        ),
        r(
          R.NumberInput.Root,
          { name: "q", defaultValue: 5, min: 0, max: 10 },
          r(R.NumberInput.Label, null, "Quantity"),
          r(
            R.NumberInput.Control,
            null,
            r(R.NumberInput.DecrementTrigger, null, "−"),
            r(R.NumberInput.Input),
            r(R.NumberInput.IncrementTrigger, null, "+"),
          ),
        ),
        r(
          R.Rating.Root,
          { name: "score", defaultValue: 3 },
          r(R.Rating.Label, null, "Score"),
          r(
            R.Rating.Control,
            null,
            r(R.Rating.Item, { index: 1 }),
            r(R.Rating.Item, { index: 2 }),
            r(R.Rating.Item, { index: 3 }),
          ),
        ),
      ),
    )
    expect(canonicalHtml(withoutHydrationKeys(html))).toBe(canonicalHtml(react))

    bootstrap(server)
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = html
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const dispose = client.hydrate(() => client.createComponent(client.App, {}), container)
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    const form = container.querySelector("form") as HTMLFormElement
    const key = (el: Element | null, k: string) =>
      el?.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))
    key(container.querySelector("input[type='range']"), "ArrowRight")
    key(container.querySelector("input[role='spinbutton']"), "ArrowUp")
    key(container.querySelector("[data-scope='rating'] input[type='range']"), "ArrowLeft")
    await vi.waitFor(() => {
      const data = new FormData(form)
      expect(data.getAll("v")).toEqual(["21", "80"])
      expect(data.get("q")).toBe("6")
      expect(data.get("score")).toBe("2")
    })
    dispose()
    container.remove()
  })
})
