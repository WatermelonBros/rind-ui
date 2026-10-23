// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// A hydrated alert was present at load: hydrating it announces nothing.
import { PENDING_ANNOUNCEMENTS } from "@rind-ui/core"
import { installAnnouncementLog } from "@rind-ui/testing"
import { waitFor } from "@testing-library/dom"
import { type Component, flushSync, hydrate, mount, unmount } from "svelte"
import { render } from "svelte/server"
import { describe, expect, it } from "vitest"
import { build } from "../../fixtures/ssr"

type Fixture = { default: Component }

describe("Svelte Alert hydration", () => {
  it("is silent; a client mount announces", async () => {
    const server = await build<Fixture>("alert/alert.svelte", "server")
    const client = await build<Fixture>("alert/alert.svelte", "client")
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = render(server.default).body
    const before = installAnnouncementLog().length
    const app = hydrate(client.default, { target: container })
    flushSync()
    await waitFor(() => expect(Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) ?? 0).toBe(0))
    expect(installAnnouncementLog().length).toBe(before)
    await unmount(app)
    container.remove()
    // The same alert mounted on the client (not present at load) announces once.
    const fresh = document.body.appendChild(document.createElement("div"))
    const mounted = mount(client.default, { target: fresh })
    flushSync()
    await waitFor(() => expect(Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) ?? 0).toBe(0))
    await waitFor(() => expect(installAnnouncementLog().length).toBe(before + 1))
    await unmount(mounted)
    fresh.remove()
  })
})
