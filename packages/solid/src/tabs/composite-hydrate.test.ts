// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// Tabs, Radio Group, Segmented Control, Collapsible, Accordion and Switch on the server: the
// HTML is React's (server tab stops, panels, ids), hydrates with no warning, and stays live.
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

const item = (value: string, label: string) =>
  r(
    R.RadioGroup.Item,
    { value },
    r(R.RadioGroup.ItemControl, null, r(R.RadioGroup.ItemIndicator)),
    r(R.RadioGroup.ItemLabel, null, label),
  )
const acc = (value: string, label: string) =>
  r(
    R.Accordion.Item,
    { value },
    r(R.Accordion.Header, null, r(R.Accordion.Trigger, null, label)),
    r(R.Accordion.Content, null, `${label}s`),
  )

describe("Solid composite parts server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; parts stay live", async () => {
    const server = await build("composite/hydrate.tsx", "ssr")
    const client = await build("composite/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        "div",
        null,
        r(
          R.Tabs.Root,
          { defaultValue: "b" },
          r(
            R.Tabs.List,
            { "aria-label": "Settings" },
            r(R.Tabs.Tab, { value: "a" }, "A"),
            r(R.Tabs.Tab, { value: "b" }, "B"),
            r(R.Tabs.Indicator),
          ),
          r(R.Tabs.Panel, { value: "a" }, "Panel A"),
          r(R.Tabs.Panel, { value: "b" }, "Panel B"),
        ),
        r(
          R.RadioGroup.Root,
          { defaultValue: "m", name: "size" },
          r(R.RadioGroup.Label, null, "Size"),
          item("s", "Small"),
          item("m", "Medium"),
        ),
        r(
          R.SegmentedControl.Root,
          { "aria-label": "Range", defaultValue: "week" },
          r(R.SegmentedControl.Item, { value: "day" }, "Day"),
          r(R.SegmentedControl.Item, { value: "week" }, "Week"),
          r(R.SegmentedControl.Indicator),
        ),
        r(
          R.Collapsible.Root,
          { defaultOpen: true },
          r(R.Collapsible.Trigger, null, "More"),
          r(R.Collapsible.Content, null, "Body"),
        ),
        r(R.Accordion.Root, { defaultValue: ["x"] }, acc("x", "X"), acc("y", "Y")),
        r(
          R.Switch.Root,
          { name: "wifi", defaultChecked: true },
          r(R.Switch.Control, null, r(R.Switch.Thumb)),
          r(R.Switch.Label, null, "Wi-Fi"),
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
    const tabA = container.querySelector("[role='tab']") as HTMLElement
    tabA.click()
    await vi.waitFor(() => expect(tabA.getAttribute("aria-selected")).toBe("true"))
    const sw = container.querySelector("[role='switch']") as HTMLElement
    sw.click()
    await vi.waitFor(() => expect(sw.getAttribute("aria-checked")).toBe("false"))
    dispose()
    container.remove()
  })
})
