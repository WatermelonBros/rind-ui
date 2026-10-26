// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// JSON Tree View server markup hydrates with no mismatch.
import { type Component, flushSync, hydrate, unmount } from "svelte"
import { render } from "svelte/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { build } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

type Fixture = { default: Component }

describe("Svelte JSON Tree View hydration", () => {
  it("server HTML has every item; hydrates with zero warnings", async () => {
    const server = await build<Fixture>("json-tree-view/hydrate.svelte", "server")
    const client = await build<Fixture>("json-tree-view/hydrate.svelte", "client")
    const container = document.body.appendChild(document.createElement("div"))
    const { body } = render(server.default)
    container.innerHTML = body
    expect(container.querySelectorAll('[role="treeitem"]').length).toBe(3)

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const app = hydrate(client.default, { target: container })
    flushSync()
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    await unmount(app)
    container.remove()
  })
})
