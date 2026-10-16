// Server markup hydrates with no mismatch warning, for Password Input and Search Field.
import { PasswordInput, SearchField } from "@rind-ui/react"
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

async function hydrate(tree: ReactNode) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(tree)
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
  })
  const calls = [...error.mock.calls, ...warn.mock.calls]
  const input = container.querySelector("input") as HTMLInputElement
  const trigger = container.querySelector('[data-part="visibility-trigger"]')
  const out = {
    calls,
    type: input.type,
    value: input.value,
    controls: trigger?.getAttribute("aria-controls") ?? null,
    inputId: input.id,
  }
  await act(async () => root?.unmount())
  container.remove()
  return out
}

describe("hydration", () => {
  it("Password Input with defaultVisible and a trigger", async () => {
    const r = await hydrate(
      <PasswordInput.Root defaultVisible>
        <PasswordInput.Label>Password</PasswordInput.Label>
        <PasswordInput.Input />
        <PasswordInput.VisibilityTrigger>
          <PasswordInput.Indicator />
        </PasswordInput.VisibilityTrigger>
      </PasswordInput.Root>,
    )
    expect(r.calls).toEqual([])
    expect(r.type).toBe("text")
    // aria-controls arrives once the Input has rendered on the client.
    expect(r.controls).toBe(r.inputId)
  })

  it("Search Field with defaultValue and a ClearTrigger", async () => {
    const r = await hydrate(
      <SearchField.Root defaultValue="dune">
        <SearchField.Label>Search books</SearchField.Label>
        <SearchField.Input />
        <SearchField.ClearTrigger />
      </SearchField.Root>,
    )
    expect(r.calls).toEqual([])
    expect(r.value).toBe("dune")
  })
})
