// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// A hydrated alert was present at load: it hydrates with no mismatch and stays silent, and it
// still closes afterwards.
import { PENDING_ANNOUNCEMENTS } from "@rind-ui/core"
import { installAnnouncementLog } from "@rind-ui/testing"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

describe("Solid Alert hydration", () => {
  it("hydrates with zero warnings and announces nothing", async () => {
    const server = await build("alert/hydrate.tsx", "ssr")
    const client = await build("alert/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    bootstrap(server)
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = html
    const before = installAnnouncementLog().length
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const dispose = client.hydrate(() => client.createComponent(client.App, {}), container)
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    const alert = container.querySelector("[data-scope='alert']")
    expect(alert).not.toBeNull()
    await vi.waitFor(() => expect(Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) ?? 0).toBe(0))
    expect(installAnnouncementLog().length).toBe(before)
    container.querySelector("button")?.click()
    await vi.waitFor(() => expect(container.querySelector("[data-scope='alert']")).toBeNull())
    dispose()
    container.remove()
  })
})
