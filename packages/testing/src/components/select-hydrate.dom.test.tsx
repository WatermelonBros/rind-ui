// Server markup hydrates without a mismatch, in Strict Mode; the server HTML carries the
// value text and the hidden input's value (task 3.4).
import { Select, type SelectRootProps } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { type ReactNode, StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const ITEMS = [
  { key: "apple", label: "Apple" },
  { key: "pear", label: "Pear" },
]

const Fruit = (root: Partial<SelectRootProps>) => (
  <Select.Root {...(root as SelectRootProps)} items={ITEMS} name="fruit" placeholder="Pick one">
    <Select.Label>Fruit</Select.Label>
    <Select.Trigger>
      <Select.ValueText />
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner>
        <Select.Content>
          <Select.List>
            {ITEMS.map((i) => (
              <Select.Item key={i.key} value={i.key}>
                <Select.ItemText>{i.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.List>
        </Select.Content>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
)

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
  const out = {
    html,
    calls: error.mock.calls,
    text: container.querySelector('[data-part="value-text"]')?.textContent,
    value: container.querySelector<HTMLInputElement>('[data-part="hidden-input"]')?.value,
  }
  await act(async () => root?.unmount())
  container.remove()
  return out
}

describe("Select hydration", () => {
  it("a value: no mismatch; the server HTML has the text and the form value", async () => {
    const r = await hydrate(<Fruit defaultValue="pear" />)
    expect(r.calls).toEqual([])
    expect(r.html).toContain(">Pear<")
    expect(r.html).toMatch(
      /data-part="hidden-input"[^>]*value="pear"|value="pear"[^>]*data-part="hidden-input"/,
    )
    expect([r.text, r.value]).toEqual(["Pear", "pear"])
  })

  it("no value: the placeholder, an empty form value", async () => {
    const r = await hydrate(<Fruit />)
    expect(r.calls).toEqual([])
    expect([r.text, r.value]).toEqual(["Pick one", ""])
  })

  it("multiple: no mismatch, the joined texts", async () => {
    const r = await hydrate(<Fruit multiple defaultValue={["apple", "pear"]} />)
    expect(r.calls).toEqual([])
    expect(r.text).toBe("Apple and Pear")
  })
})
