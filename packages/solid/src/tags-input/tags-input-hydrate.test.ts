// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// A Tags Input with tags and suggestions on the server: the HTML is React's, hydrates with
// no warning, and a tag can be added afterwards.
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

const ITEMS = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
]

describe("Solid Tags Input server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; adds a tag", async () => {
    const server = await build("tags-input/hydrate.tsx", "ssr")
    const client = await build("tags-input/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        "div",
        null,
        r(
          R.TagsInput.Root,
          { items: ITEMS, defaultValue: ["rome"], name: "tags", id: "tags" },
          r(R.TagsInput.Label, null, "Tags"),
          r(
            R.TagsInput.Control,
            null,
            r(R.TagsInput.Chips),
            r(R.TagsInput.Input),
            r(R.TagsInput.ClearTrigger),
          ),
          r(
            R.TagsInput.Positioner,
            null,
            r(R.TagsInput.Popup, null, r(R.TagsInput.List, null, r(R.TagsInput.Items))),
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
    const input = container.querySelector<HTMLInputElement>("input[type='text'], input:not([type])")
    expect(input).toBeTruthy()
    input?.focus()
    if (input) input.value = "oslo"
    input?.dispatchEvent(new Event("input", { bubbles: true }))
    input?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    )
    await vi.waitFor(() => expect(container.querySelectorAll("[data-part='chip']").length).toBe(2))
    dispose()
    container.remove()
  })
})
