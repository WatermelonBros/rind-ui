// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// Timer server markup hydrates with no mismatch, then runs.
import { type Component, flushSync, hydrate, unmount } from "svelte"
import { render } from "svelte/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { build } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

type Fixture = { default: Component }

describe("Svelte Timer hydration", () => {
  it("server HTML is a named timer; hydrates with zero warnings", async () => {
    const server = await build<Fixture>("timer/hydrate.svelte", "server")
    const client = await build<Fixture>("timer/hydrate.svelte", "client")
    const container = document.body.appendChild(document.createElement("div"))
    const { body } = render(server.default)
    container.innerHTML = body
    expect(container.querySelector('[role="timer"]')?.getAttribute("aria-label")).toBe(
      "1 minute, 5 seconds",
    )

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const app = hydrate(client.default, { target: container })
    flushSync()
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    const toggle = container.querySelector('[data-action="toggle"]') as HTMLElement
    toggle.click()
    await vi.waitFor(() => expect(toggle.textContent).toBe("Pause"))
    await unmount(app)
    container.remove()
  })
})
