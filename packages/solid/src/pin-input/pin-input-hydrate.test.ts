// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// Pin Input and Splitter on the server: the HTML is React's, hydrates with no warning, and the
// controls stay live (a typed code reaches the form, a key moves the splitter).
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

describe("Solid Pin Input and Splitter server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; controls stay live", async () => {
    const server = await build("pin-splitter/hydrate.tsx", "ssr")
    const client = await build("pin-splitter/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        "form",
        null,
        r(
          R.PinInput.Root,
          { length: 4, name: "code", defaultValue: "12" },
          r(R.PinInput.Label, null, "Code"),
          r(
            R.PinInput.Control,
            null,
            r(R.PinInput.Input),
            [0, 1, 2, 3].map((i) => r(R.PinInput.Slot, { key: i, index: i })),
          ),
        ),
        r(
          R.Splitter.Root,
          { panels: [{ min: 10 }, { min: 10 }], defaultSizes: [30, 70] },
          r(R.Splitter.Panel, { index: 0 }, "One"),
          r(R.Splitter.Handle, { index: 0, "aria-label": "One" }),
          r(R.Splitter.Panel, { index: 1 }, "Two"),
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
    const input = container.querySelector("input[name='code']") as HTMLInputElement
    input.value = "1234"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    const handle = container.querySelector("[role='separator']") as HTMLElement
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    await vi.waitFor(() => {
      expect(new FormData(container.querySelector("form") as HTMLFormElement).get("code")).toBe(
        "1234",
      )
      expect(handle.getAttribute("aria-valuenow")).toBe("35")
    })
    dispose()
    container.remove()
  })
})
