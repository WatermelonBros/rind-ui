// Server markup hydrates with no mismatch warning (tasks 4.2).
import { PinInput } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

describe("PinInput hydration", () => {
  it("defaultValue, Label and six Slots", async () => {
    const tree = (
      <PinInput.Root length={6} defaultValue="12">
        <PinInput.Label>Verification code</PinInput.Label>
        <PinInput.Control>
          <PinInput.Input />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <PinInput.Slot key={i} index={i} />
          ))}
        </PinInput.Control>
      </PinInput.Root>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("12")
    expect(container.querySelectorAll('[data-part="slot"][data-filled]')).toHaveLength(2)
    await act(async () => root?.unmount())
    container.remove()
  })
})
