// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// Button server markup (button-like-element): native button, link with href; hydrates cleanly.
import { type Component, flushSync, hydrate, unmount } from "svelte"
import { render } from "svelte/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { build } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

type Fixture = { default: Component }

describe("Svelte Button server render and hydration", () => {
  it("server HTML is final; hydrates with zero warnings", async () => {
    const server = await build<Fixture>("button/link.svelte", "server")
    const client = await build<Fixture>("button/link.svelte", "client")
    const { body } = render(server.default)
    expect(body).toMatch(/<a [^>]*href="\/docs"/)
    expect(body).toMatch(/<button [^>]*type="button"[^>]* disabled/)
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = body
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const app = hydrate(client.default, { target: container })
    flushSync()
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    await unmount(app)
    container.remove()
  })
})
