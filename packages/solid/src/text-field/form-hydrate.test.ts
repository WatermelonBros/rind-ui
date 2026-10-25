// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// A form of Text Field, Checkbox and Checkbox Group: the server HTML is React's, hydrates with
// no mismatch, and the controls stay live (an edit survives, a toggle works).
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

describe("Solid form controls server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; controls stay live", async () => {
    const server = await build("form/hydrate.tsx", "ssr")
    const client = await build("form/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        "form",
        null,
        r(
          R.TextField.Root,
          { name: "handle", required: true },
          r(R.TextField.Label, null, "Handle"),
          r(R.TextField.Input),
          r(R.TextField.Description, null, "Hint"),
          r(R.TextField.ErrorMessage),
        ),
        r(
          R.Checkbox.Root,
          { name: "tos", defaultChecked: true },
          r(R.Checkbox.Control, null, r(R.Checkbox.Indicator, null, "✓")),
          r(R.Checkbox.Label, null, "Accept"),
        ),
        r(
          R.CheckboxGroup.Root,
          { name: "toppings", defaultValue: ["a"] },
          r(R.CheckboxGroup.Label, null, "Toppings"),
          r(
            R.CheckboxGroup.Item,
            { value: "a" },
            r(R.CheckboxGroup.ItemControl),
            r(R.CheckboxGroup.ItemLabel, null, "Olives"),
          ),
          r(
            R.CheckboxGroup.Item,
            { value: "b" },
            r(R.CheckboxGroup.ItemControl),
            r(R.CheckboxGroup.ItemLabel, null, "Basil"),
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
    const input = container.querySelector("input[name='handle']") as HTMLInputElement
    input.value = "ada"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    const basil = container.querySelectorAll("[role='checkbox']")[2] as HTMLElement
    basil.click()
    await vi.waitFor(() => expect(basil.getAttribute("aria-checked")).toBe("true"))
    expect(input.value).toBe("ada")
    dispose()
    container.remove()
  })
})
