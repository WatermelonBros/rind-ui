// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// JSON Tree View server markup hydrates with no mismatch.
import { type Component, flushSync, hydrate, unmount } from "svelte"
import { render } from "svelte/server"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { build } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

type Fixture = { default: Component }

describe("Svelte JSON Tree View hydration", () => {
  // Compiling the fixture (Tree View and the JSON model, twice) is the slow part: on a busy CI
  // runner it alone exceeded the 5 s test timeout. The test itself measures the hydration.
  let server: Fixture
  let client: Fixture
  beforeAll(async () => {
    server = await build<Fixture>("json-tree-view/hydrate.svelte", "server")
    client = await build<Fixture>("json-tree-view/hydrate.svelte", "client")
  }, 30_000)

  it("server HTML has every item; hydrates with zero warnings", async () => {
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
