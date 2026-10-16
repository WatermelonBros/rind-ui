// Server markup hydrates with no warning or error, with and without a label.
import { Badge } from "@rind-ui/react"
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
  const before = container.innerHTML
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
  })
  const calls = [...error.mock.calls, ...warn.mock.calls]
  const after = container.innerHTML
  await act(async () => root?.unmount())
  container.remove()
  return { calls, before, after }
}

describe("Badge hydration", () => {
  const trees: Record<string, () => ReactNode> = {
    text: () => <Badge.Root>Beta</Badge.Root>,
    label: () => <Badge.Root label="3 unread">3</Badge.Root>,
    "in a described button": () => (
      <button type="button" aria-label="Comments" aria-describedby="c">
        <Badge.Root id="c" label="3 unread" data-tone="danger">
          3
        </Badge.Root>
      </button>
    ),
  }
  it.each(Object.keys(trees))("%s hydrates cleanly with the same attributes", async (name) => {
    const { calls, before, after } = await hydrate(trees[name]?.())
    expect(calls).toEqual([])
    expect(after).toBe(before)
  })
})
