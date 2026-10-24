// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// Toggle server markup hydrates with no mismatch; ids come from $props.id() on both sides.
import { type Component, flushSync, hydrate, unmount } from "svelte"
import { render } from "svelte/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { build } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

type Fixture = { default: Component }

describe("Svelte Toggle hydration", () => {
  it("server HTML is pressed and labelled; hydrates with zero warnings", async () => {
    const server = await build<Fixture>("toggle/hydrate.svelte", "server")
    const client = await build<Fixture>("toggle/hydrate.svelte", "client")
    const container = document.body.appendChild(document.createElement("div"))
    const { body } = render(server.default)
    container.innerHTML = body
    const [bold, italic] = Array.from(container.querySelectorAll("button"))
    expect(bold?.getAttribute("aria-pressed")).toBe("true")
    expect(italic?.getAttribute("aria-pressed")).toBe("false")
    expect(bold?.getAttribute("data-instance")).not.toBe(italic?.getAttribute("data-instance"))

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const app = hydrate(client.default, { target: container })
    flushSync()
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    const live = container.querySelector("button")
    live?.click()
    await vi.waitFor(() => expect(live?.getAttribute("aria-pressed")).toBe("false"))
    await unmount(app)
    container.remove()
  })
})
