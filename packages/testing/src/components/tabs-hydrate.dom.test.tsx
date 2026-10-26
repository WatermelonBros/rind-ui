// Tabs server markup (spec "Tab Stop And Focus", "Selection Indicator"): the tab stop exists
// before hydration (selected tab, else the first enabled) and hydration is silent.
import { Tabs } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (defaultValue?: string) => (
  <Tabs.Root {...(defaultValue ? { defaultValue } : {})}>
    <Tabs.List aria-label="Settings">
      {["a", "b", "c"].map((v) => (
        <Tabs.Tab key={v} value={v}>
          {v}
        </Tabs.Tab>
      ))}
      <Tabs.Indicator />
    </Tabs.List>
    {["a", "b", "c"].map((v) => (
      <Tabs.Panel key={v} value={v}>
        panel {v}
      </Tabs.Panel>
    ))}
  </Tabs.Root>
)

const parse = (defaultValue?: string) => {
  const box = document.createElement("div")
  box.innerHTML = renderToString(tree(defaultValue))
  return box
}
const tabs = (box: Element) => [...box.querySelectorAll<HTMLElement>('[role="tab"]')]

describe("Tabs hydration", () => {
  it("defaultValue b: the server tab stop, ids and selection are b", () => {
    const box = parse("b")
    const all = tabs(box)
    expect(all.map((t) => t.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"])
    expect(all.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"])
    expect(all.every((t) => t.id !== "")).toBe(true)
    const panel = box.querySelector('[role="tabpanel"]')
    expect(panel?.textContent).toBe("panel b")
    expect(all[1]?.getAttribute("aria-controls")).toBe(panel?.id)
    expect(panel?.getAttribute("aria-labelledby")).toBe(all[1]?.id)
    expect(box.querySelector('[role="tablist"]')?.hasAttribute("tabindex")).toBe(false)
  })

  it("no value: the server tab stop, selection and panel are the first tab", () => {
    const box = parse()
    expect(tabs(box).map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"])
    expect(tabs(box).map((t) => t.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ])
    expect(box.querySelector('[role="tabpanel"]')?.textContent).toBe("panel a")
  })

  it("the indicator is rendered hidden with no custom properties", () => {
    const ind = parse("b").querySelector<HTMLElement>('[data-part="indicator"]')
    expect(ind).not.toBeNull()
    expect(ind?.hasAttribute("hidden")).toBe(true)
    expect(ind?.getAttribute("data-state")).toBe("hidden")
    expect(ind?.getAttribute("aria-hidden")).toBe("true")
    expect(ind?.getAttribute("style") ?? "").not.toContain("--rind-indicator")
  })

  it("hydrates with zero console errors or warnings, also under StrictMode", async () => {
    for (const strict of [false, true]) {
      for (const value of ["b", undefined]) {
        const wrap = (ui: ReturnType<typeof tree>) => (strict ? <StrictMode>{ui}</StrictMode> : ui)
        const container = document.createElement("div")
        container.innerHTML = renderToString(wrap(tree(value)))
        document.body.append(container)
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
        let root: ReturnType<typeof hydrateRoot> | undefined
        await act(async () => {
          root = hydrateRoot(container, wrap(tree(value)), {
            onRecoverableError: (e) => error(String(e)),
          })
        })
        const calls = [...error.mock.calls, ...warn.mock.calls]
        const stops = tabs(container).filter((t) => t.tabIndex === 0)
        await act(async () => root?.unmount())
        container.remove()
        error.mockRestore()
        warn.mockRestore()
        expect(calls, `strict=${strict} value=${value}`).toEqual([])
        expect(stops.map((t) => t.textContent)).toEqual([value ?? "a"])
      }
    }
  })
})
