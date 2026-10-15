// Segmented Control server markup (spec "Server render", "Selection Indicator"): the tab
// stop, the indicator's hidden state and the submitted value exist before hydration, and
// hydration is silent.
import { SegmentedControl } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (defaultValue?: string) => (
  <form>
    <SegmentedControl.Root name="range" {...(defaultValue ? { defaultValue } : {})}>
      <SegmentedControl.Label>Range</SegmentedControl.Label>
      {["day", "week", "month"].map((v) => (
        <SegmentedControl.Item key={v} value={v}>
          {v}
        </SegmentedControl.Item>
      ))}
      <SegmentedControl.Indicator />
    </SegmentedControl.Root>
  </form>
)

const parse = (defaultValue?: string) => {
  const box = document.createElement("div")
  box.innerHTML = renderToString(tree(defaultValue))
  return box
}
const segments = (box: Element) => [...box.querySelectorAll<HTMLElement>('[role="radio"]')]

describe("Segmented Control hydration", () => {
  it("defaultValue week: the server tab stop and selection are week", () => {
    const box = parse("week")
    const root = box.querySelector('[role="radiogroup"]') as HTMLElement
    const label = box.querySelector('[data-part="label"]') as HTMLElement
    expect(root.getAttribute("aria-labelledby")).toBe(label.id)
    const all = segments(box)
    expect(all.map((s) => s.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"])
    expect(all.map((s) => s.getAttribute("aria-checked"))).toEqual(["false", "true", "false"])
    expect(all.every((s) => s.id !== "")).toBe(true)
  })

  it("no value: the server tab stop is the first segment", () => {
    expect(segments(parse()).map((s) => s.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"])
  })

  it("the indicator is rendered hidden with no custom properties", () => {
    const ind = parse("week").querySelector<HTMLElement>('[data-part="indicator"]')
    expect(ind).not.toBeNull()
    expect(ind?.hasAttribute("hidden")).toBe(true)
    expect(ind?.getAttribute("data-state")).toBe("hidden")
    expect(ind?.getAttribute("aria-hidden")).toBe("true")
    expect(ind?.getAttribute("style") ?? "").not.toContain("--rind-indicator")
  })

  it("the hidden input of week is checked; a form submitted before hydration has range=week", () => {
    const box = parse("week")
    const inputs = [...box.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]')]
    expect(inputs.map((i) => i.hasAttribute("checked"))).toEqual([false, true, false])
    expect([...new FormData(box.querySelector("form") as HTMLFormElement)]).toEqual([
      ["range", "week"],
    ])
    expect([...new FormData(parse().querySelector("form") as HTMLFormElement)]).toEqual([])
  })

  it("hydrates with zero console errors or warnings, also under StrictMode", async () => {
    for (const strict of [false, true]) {
      for (const value of ["week", undefined]) {
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
        const stops = segments(container).filter((s) => s.tabIndex === 0)
        const inputs = [
          ...container.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]'),
        ]
        await act(async () => root?.unmount())
        container.remove()
        error.mockRestore()
        warn.mockRestore()
        expect(calls, `strict=${strict} value=${value}`).toEqual([])
        expect(stops.map((s) => s.textContent)).toEqual([value ?? "day"])
        expect(inputs.map((i) => i.checked)).toEqual(
          value ? [false, true, false] : [false, false, false],
        )
      }
    }
  })
})
