// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// The server HTML carries the initial value (an attribute, so the DOM keeps edits) and the
// label relation; it hydrates with no warning and the value stays editable.
import { type Component, flushSync, hydrate, unmount } from "svelte"
import { render } from "svelte/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { build } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())
type Fixture = { default: Component }

describe("Svelte Text Field server render", () => {
  it("initial values in the HTML; hydrates cleanly", async () => {
    const server = await build<Fixture>("text-field/server.svelte", "server")
    const client = await build<Fixture>("text-field/server.svelte", "client")
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = render(server.default).body
    const input = container.querySelector("input")
    const textarea = container.querySelector("textarea")
    expect(input?.value).toBe("pw")
    expect(input?.getAttribute("type")).toBe("password")
    expect(textarea?.value).toBe("b")
    expect(container.querySelector("label")?.getAttribute("for")).toBe(input?.id)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const app = hydrate(client.default, { target: container })
    flushSync()
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    await unmount(app)
    container.remove()
  })
})
