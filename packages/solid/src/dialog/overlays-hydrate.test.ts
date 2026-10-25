// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// A closed Popover and Dialog on the server: the HTML is React's (a trigger, nothing portalled),
// hydrates with no warning, and both open afterwards.
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

describe("Solid Popover and Dialog server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; both open", async () => {
    const server = await build("overlays/hydrate.tsx", "ssr")
    const client = await build("overlays/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        "div",
        null,
        r(
          R.Popover.Root,
          null,
          r(R.Popover.Trigger, null, "Filters"),
          r(
            R.Popover.Portal,
            null,
            r(
              R.Popover.Positioner,
              null,
              r(
                R.Popover.Content,
                null,
                r(R.Popover.Title, null, "Filters"),
                r(R.Popover.CloseTrigger, null, "Done"),
              ),
            ),
          ),
        ),
        r(
          R.Dialog.Root,
          null,
          r(R.Dialog.Trigger, null, "Edit profile"),
          r(
            R.Dialog.Portal,
            null,
            r(R.Dialog.Backdrop),
            r(
              R.Dialog.Positioner,
              null,
              r(
                R.Dialog.Content,
                null,
                r(R.Dialog.Title, null, "Edit profile"),
                r(R.Dialog.CloseTrigger, null, "Close"),
              ),
            ),
          ),
        ),
      ),
    )
    expect(canonicalHtml(withoutHydrationKeys(html))).toBe(canonicalHtml(react))

    bootstrap(server)
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = html
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const dispose = client.hydrate(() => client.createComponent(client.App, {}), container)
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    const buttons = container.querySelectorAll<HTMLElement>("button[aria-haspopup='dialog']")
    expect(buttons.length).toBe(2)
    for (const trigger of buttons) trigger.click()
    await vi.waitFor(() =>
      expect(document.querySelectorAll("[role='dialog'][data-state='open']").length).toBe(2),
    )
    dispose()
    container.remove()
  })
})
