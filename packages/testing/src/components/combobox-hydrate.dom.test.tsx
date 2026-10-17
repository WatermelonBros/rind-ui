// Server markup hydrates without a mismatch in Strict Mode; the server renders no popup.
import { Combobox } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { type ReactNode, StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const ITEMS = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
]

function Box(props: Record<string, unknown>) {
  return (
    <form>
      <Combobox.Root items={ITEMS} name="city" {...props}>
        <Combobox.Label>City</Combobox.Label>
        <Combobox.Control>
          <Combobox.Chips />
          <Combobox.Input />
          <Combobox.Trigger />
        </Combobox.Control>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              <Combobox.Items />
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Root>
    </form>
  )
}

async function hydrate(tree: ReactNode) {
  const html = renderToString(tree)
  const container = document.createElement("div")
  container.innerHTML = html
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, <StrictMode>{tree}</StrictMode>, {
      onRecoverableError: (e) => error(String(e)),
    })
  })
  const input = container.querySelector('[role="combobox"]') as HTMLInputElement
  const out = {
    html,
    calls: error.mock.calls,
    text: input.value,
    data: [...new FormData(container.querySelector("form") as HTMLFormElement).entries()].map(
      ([k, v]) => `${k}=${v}`,
    ),
  }
  await act(async () => root?.unmount())
  container.remove()
  return out
}

describe("Combobox hydration", () => {
  it("single with a default value: no mismatch, its text, no listbox on the server", async () => {
    const r = await hydrate(<Box defaultValue="paris" />)
    expect(r.calls).toEqual([])
    expect(r.text).toBe("Paris")
    expect(r.data).toEqual(["city=paris"])
    expect(r.html).not.toContain('role="listbox"')
  })

  it("multiple with chips: no mismatch, one entry per key", async () => {
    const r = await hydrate(<Box multiple defaultValue={["rome", "paris"]} />)
    expect(r.calls).toEqual([])
    expect(r.data).toEqual(["city=rome", "city=paris"])
    expect(r.html).toContain('role="toolbar"')
  })
})
