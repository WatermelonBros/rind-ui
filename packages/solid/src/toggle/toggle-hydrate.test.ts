// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// Toggle server markup hydrates with no mismatch; ids come from createUniqueId() on both sides;
// the server HTML is React's.
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { Fragment, createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

describe("Solid Toggle server render and hydration", () => {
  it("server HTML is pressed, matches React; hydrates with zero warnings", async () => {
    const server = await build("toggle/hydrate.tsx", "ssr")
    const client = await build("toggle/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        Fragment,
        null,
        r(R.Toggle.Root, { defaultPressed: true }, "Bold"),
        r(R.Toggle.Root, null, "Italic"),
      ),
    )
    // Ids differ by framework (React's useId, Solid's createUniqueId): compared without them.
    const noIds = (s: string) => s.replace(/ (id|data-instance)="[^"]*"/g, "")
    expect(noIds(canonicalHtml(withoutHydrationKeys(html)))).toBe(noIds(canonicalHtml(react)))

    bootstrap(server)
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = html
    const [bold, italic] = Array.from(container.querySelectorAll("button"))
    expect(bold?.getAttribute("aria-pressed")).toBe("true")
    expect(italic?.getAttribute("aria-pressed")).toBe("false")
    expect(bold?.getAttribute("data-instance")).not.toBe(italic?.getAttribute("data-instance"))

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const dispose = client.hydrate(() => client.createComponent(client.App, {}), container)
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    // Hydrated, not replaced: the server's elements are live.
    expect(container.querySelector("button")).toBe(bold)
    bold?.click()
    await vi.waitFor(() => expect(bold?.getAttribute("aria-pressed")).toBe("false"))
    dispose()
    container.remove()
  })
})
