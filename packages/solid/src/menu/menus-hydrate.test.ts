// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// A closed Menu, Select and Combobox on the server: the HTML is React's (triggers, a hidden
// form input, nothing portalled), hydrates with no warning, and all three open afterwards.
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

const ITEMS = [
  { key: "apple", label: "Apple" },
  { key: "pear", label: "Pear" },
]

describe("Solid Menu, Select and Combobox server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; all three open", async () => {
    const server = await build("menus/hydrate.tsx", "ssr")
    const client = await build("menus/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        "div",
        null,
        r(
          R.Menu.Root,
          null,
          r(R.Menu.Trigger, null, "Actions"),
          r(
            R.Menu.Portal,
            null,
            r(
              R.Menu.Positioner,
              null,
              r(
                R.Menu.Content,
                null,
                r(R.Menu.Item, { value: "copy" }, "Copy"),
                r(R.Menu.Item, { value: "paste" }, "Paste"),
              ),
            ),
          ),
        ),
        r(
          R.Select.Root,
          { items: ITEMS, placeholder: "Pick one", defaultValue: "pear", name: "fruit" },
          r(R.Select.Label, null, "Fruit"),
          r(R.Select.Trigger, null, r(R.Select.ValueText), r(R.Select.Indicator)),
          r(
            R.Select.Portal,
            null,
            r(
              R.Select.Positioner,
              null,
              r(R.Select.Content, null, r(R.Select.List, null, r(R.Select.Items))),
            ),
          ),
        ),
        r(
          R.Combobox.Root,
          { items: ITEMS, defaultValue: "apple", name: "city" },
          r(R.Combobox.Label, null, "City"),
          r(R.Combobox.Control, null, r(R.Combobox.Input), r(R.Combobox.Trigger)),
          r(
            R.Combobox.Positioner,
            null,
            r(R.Combobox.Popup, null, r(R.Combobox.List, null, r(R.Combobox.Items))),
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
    const menu = container.querySelector<HTMLElement>("button[aria-haspopup='menu']")
    const select = container.querySelector<HTMLElement>("button[aria-haspopup='listbox']")
    const combo = container.querySelector<HTMLElement>("input[role='combobox']")
    expect(menu && select && combo).toBeTruthy()
    const pressEscape = () =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      )
    menu?.click()
    await vi.waitFor(() =>
      expect(document.querySelector("[role='menu'][data-state='open']")).toBeTruthy(),
    )
    pressEscape()
    await vi.waitFor(() =>
      expect(document.querySelector("[role='menu'][data-state='open']")).toBeNull(),
    )
    select?.click()
    await vi.waitFor(() => expect(select?.getAttribute("aria-expanded")).toBe("true"))
    pressEscape()
    await vi.waitFor(() => expect(select?.getAttribute("aria-expanded")).toBe("false"))
    combo?.focus()
    combo?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    )
    await vi.waitFor(() => expect(combo?.getAttribute("aria-expanded")).toBe("true"))
    dispose()
    container.remove()
  })
})
