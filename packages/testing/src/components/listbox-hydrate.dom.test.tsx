// Server markup hydrates without a mismatch, static and data items, in Strict Mode.
import { Listbox } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { type ReactNode, StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

async function hydrate(tree: ReactNode) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(tree)
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, <StrictMode>{tree}</StrictMode>, {
      onRecoverableError: (e) => error(String(e)),
    })
  })
  const stops = [...container.querySelectorAll('[role="option"]')].filter(
    (o) => (o as HTMLElement).tabIndex === 0,
  )
  const out = {
    calls: error.mock.calls,
    stop: stops[0]?.getAttribute("data-key") ?? null,
    stops: stops.length,
  }
  await act(async () => root?.unmount())
  container.remove()
  return out
}

describe("Listbox hydration", () => {
  it("data items: no mismatch, the selected item is the tab stop", async () => {
    const r = await hydrate(
      <Listbox.Root items={["a", "b", "c"].map((k) => ({ key: k, label: k }))} defaultValue="b">
        <Listbox.List aria-label="Fruit">
          <Listbox.Items />
        </Listbox.List>
      </Listbox.Root>,
    )
    expect(r.calls).toEqual([])
    expect([r.stop, r.stops]).toEqual(["b", 1])
  })

  it("static items: no mismatch, one tab stop", async () => {
    const r = await hydrate(
      <Listbox.Root defaultValue="b">
        <Listbox.List aria-label="Fruit">
          <Listbox.Item value="a">a</Listbox.Item>
          <Listbox.Item value="b">b</Listbox.Item>
        </Listbox.List>
      </Listbox.Root>,
    )
    expect(r.calls).toEqual([])
    expect(r.stops).toBe(1)
  })
})
