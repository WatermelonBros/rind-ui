// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// The Toggle Group's server HTML (one tab stop before the items register) is React's, and
// hydrates with no mismatch.
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

describe("Solid Toggle Group server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings", async () => {
    const server = await build("toggle-group/hydrate.tsx", "ssr")
    const client = await build("toggle-group/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        R.ToggleGroup.Root,
        { "aria-label": "Alignment", defaultValue: ["center"] },
        r(R.ToggleGroup.Item, { value: "left" }, "Left"),
        r(R.ToggleGroup.Item, { value: "center" }, "Center"),
        r(R.ToggleGroup.Item, { value: "right", disabled: true }, "Right"),
      ),
    )
    // Ids differ by framework (React's useId, Solid's createUniqueId): compared without them.
    const noIds = (s: string) => s.replace(/ (id|data-instance)="[^"]*"/g, "")
    expect(noIds(canonicalHtml(withoutHydrationKeys(html)))).toBe(noIds(canonicalHtml(react)))

    bootstrap(server)
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = html
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const dispose = client.hydrate(() => client.createComponent(client.App, {}), container)
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    const [left, center] = Array.from(container.querySelectorAll("button"))
    expect(center?.getAttribute("aria-pressed")).toBe("true")
    left?.click()
    await vi.waitFor(() => expect(left?.getAttribute("aria-pressed")).toBe("true"))
    expect(center?.getAttribute("aria-pressed")).toBe("false")
    dispose()
    container.remove()
  })
})
