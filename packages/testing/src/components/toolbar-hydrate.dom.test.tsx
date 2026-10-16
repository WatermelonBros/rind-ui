// Toolbar server markup (spec "One Tab Stop With Focus Memory", composite-host "Host
// Detection"): the tab stop exists before hydration, including with a hosted toggle group
// first, and hydration is silent.
import { RadioGroup, ToggleGroup, Toolbar } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const toggles = (
  <ToggleGroup.Root aria-label="Style" selectionMode="multiple" defaultValue={["b"]}>
    <ToggleGroup.Item value="b">Bold</ToggleGroup.Item>
    <ToggleGroup.Item value="i">Italic</ToggleGroup.Item>
  </ToggleGroup.Root>
)
const tree = (groupFirst: boolean, radios = true) => (
  <Toolbar.Root aria-label="Formatting">
    {groupFirst && toggles}
    <Toolbar.Button>Undo</Toolbar.Button>
    {!groupFirst && toggles}
    <Toolbar.Separator />
    {radios && (
      <RadioGroup.Root aria-label="Alignment" defaultValue="l">
        {["l", "r"].map((v) => (
          <RadioGroup.Item key={v} value={v}>
            <RadioGroup.ItemControl />
            <RadioGroup.ItemLabel>{v === "l" ? "Left" : "Right"}</RadioGroup.ItemLabel>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    )}
    <Toolbar.Link href="/docs">Docs</Toolbar.Link>
  </Toolbar.Root>
)

const parse = (groupFirst: boolean) => {
  const box = document.createElement("div")
  box.innerHTML = renderToString(tree(groupFirst))
  return box
}
const controls = (box: Element) => [...box.querySelectorAll<HTMLElement>('[data-host="toolbar"]')]

describe("Toolbar hydration", () => {
  it("server markup: exactly one control has tabindex 0, the first rendered", () => {
    const box = parse(false)
    const all = controls(box)
    expect(all.map((c) => c.textContent || c.getAttribute("aria-label"))).toHaveLength(6)
    expect(all.filter((c) => c.getAttribute("tabindex") === "0").map((c) => c.textContent)).toEqual(
      ["Undo"],
    )
    expect(box.querySelector('[role="toolbar"]')?.hasAttribute("tabindex")).toBe(false)
  })

  it("a hosted toggle group first: its first item is the only stop; group roots have none", () => {
    const box = parse(true)
    const stops = controls(box).filter((c) => c.getAttribute("tabindex") === "0")
    expect(stops.map((c) => c.textContent)).toEqual(["Bold"])
    expect(box.querySelector('[role="group"]')?.hasAttribute("tabindex")).toBe(false)
    expect(box.querySelector('[role="radiogroup"]')?.hasAttribute("tabindex")).toBe(false)
    expect(box.querySelector('[aria-pressed="true"]')?.textContent).toBe("Bold")
  })

  it.each([
    ["with a hosted radio group", true],
    ["without a radio group", false],
  ])(
    "hydrates with zero console errors or warnings, also under StrictMode, %s",
    async (_n, radios) => {
      for (const strict of [false, true]) {
        for (const groupFirst of [false, true]) {
          const wrap = (ui: ReturnType<typeof tree>) =>
            strict ? <StrictMode>{ui}</StrictMode> : ui
          const container = document.createElement("div")
          container.innerHTML = renderToString(wrap(tree(groupFirst, radios)))
          document.body.append(container)
          const error = vi.spyOn(console, "error").mockImplementation(() => {})
          const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
          let root: ReturnType<typeof hydrateRoot> | undefined
          await act(async () => {
            root = hydrateRoot(container, wrap(tree(groupFirst, radios)), {
              onRecoverableError: (e) => error(String(e)),
            })
          })
          const calls = [...error.mock.calls, ...warn.mock.calls]
          const stops = controls(container).filter((c) => c.getAttribute("tabindex") === "0")
          await act(async () => root?.unmount())
          container.remove()
          error.mockRestore()
          warn.mockRestore()
          expect(calls, `strict=${strict} groupFirst=${groupFirst}`).toEqual([])
          expect(stops.map((c) => c.textContent)).toEqual([groupFirst ? "Bold" : "Undo"])
        }
      }
    },
  )
})
