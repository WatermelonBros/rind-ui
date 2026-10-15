// Toggle Group server markup (spec "Tab Stop And Focus"): the tab stop exists before
// hydration (value item, else the first item) and hydration is silent.
import { ToggleGroup } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (defaultValue?: string[]) => (
  <ToggleGroup.Root aria-label="Alignment" {...(defaultValue ? { defaultValue } : {})}>
    {["left", "center", "right"].map((v) => (
      <ToggleGroup.Item key={v} value={v}>
        {v}
      </ToggleGroup.Item>
    ))}
  </ToggleGroup.Root>
)

const parse = (defaultValue?: string[]) => {
  const box = document.createElement("div")
  box.innerHTML = renderToString(tree(defaultValue))
  return box
}
const tabIndexes = (box: Element) =>
  [...box.querySelectorAll<HTMLElement>('[data-part="item"]')].map((i) =>
    i.getAttribute("tabindex"),
  )

describe("Toggle Group hydration", () => {
  it("defaultValue center: the server tab stop is center", () => {
    const box = parse(["center"])
    expect(tabIndexes(box)).toEqual(["-1", "0", "-1"])
    const items = [...box.querySelectorAll<HTMLElement>("button")]
    expect(items.map((i) => i.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"])
    expect(box.querySelector('[role="group"]')?.hasAttribute("tabindex")).toBe(false)
  })

  it("no value: the server tab stop is the first item", () => {
    expect(tabIndexes(parse())).toEqual(["0", "-1", "-1"])
  })

  it("hydrates with zero console errors or warnings", async () => {
    for (const value of [["center"], undefined]) {
      const container = document.createElement("div")
      container.innerHTML = renderToString(tree(value))
      document.body.append(container)
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      let root: ReturnType<typeof hydrateRoot> | undefined
      await act(async () => {
        root = hydrateRoot(container, tree(value), { onRecoverableError: (e) => error(String(e)) })
      })
      const calls = [...error.mock.calls, ...warn.mock.calls]
      const stops = [...container.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.tabIndex === 0,
      )
      await act(async () => root?.unmount())
      container.remove()
      error.mockRestore()
      warn.mockRestore()
      expect(calls).toEqual([])
      expect(stops.map((b) => b.textContent)).toEqual([value ? "center" : "left"])
    }
  })
})

describe("review fixes (add-toggle-group r1): the server tab stop", () => {
  const render = (value: string[], disabled: string[] = [], multiple = false) => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(
      <ToggleGroup.Root
        aria-label="Alignment"
        defaultValue={value}
        selectionMode={multiple ? "multiple" : "single"}
      >
        {["left", "center", "right"].map((v) => (
          <ToggleGroup.Item key={v} value={v} disabled={disabled.includes(v)}>
            {v}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>,
    )
    return tabIndexes(box)
  }

  it("unordered multiple value: the first RENDERED selected item", () => {
    expect(render(["right", "left"], [], true)).toEqual(["0", "-1", "-1"])
  })

  it("a stale value (no such item): the first rendered item", () => {
    expect(render(["gone"])).toEqual(["0", "-1", "-1"])
  })

  it("a disabled first item: the first enabled item", () => {
    expect(render([], ["left"])).toEqual(["-1", "0", "-1"])
  })
})
