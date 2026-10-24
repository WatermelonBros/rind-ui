// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// The server HTML has one tab stop per group (the selected item, else the first enabled one)
// before any item registered, and hydrates cleanly.
import { type Component, flushSync, hydrate, unmount } from "svelte"
import { render } from "svelte/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { build } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())
type Fixture = { default: Component }

describe("Svelte Toggle Group server render", () => {
  it("one tab stop per group; hydrates with zero warnings", async () => {
    const server = await build<Fixture>("toggle-group/server.svelte", "server")
    const client = await build<Fixture>("toggle-group/server.svelte", "client")
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = render(server.default).body
    const stops = (root: ParentNode) =>
      Array.from(root.querySelectorAll('[role="group"]')).map((g) =>
        Array.from(g.querySelectorAll("button"))
          .filter((b) => b.getAttribute("tabindex") !== "-1")
          .map((b) => b.textContent),
      )
    expect(stops(container)).toEqual([["Center"], ["Y"]])
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const app = hydrate(client.default, { target: container })
    flushSync()
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    await unmount(app)
    container.remove()
  })
})
