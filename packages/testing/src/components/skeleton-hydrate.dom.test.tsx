// Server markup hydrates with no warning and the same attributes (spec "Loading State").
import { Skeleton } from "@rind-ui/react"
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

const tree = (loading: boolean) => (
  <Skeleton.Root loading={loading} announceOnLoad>
    <Skeleton.Status />
    <Skeleton.Content>
      <Skeleton.Item />
      <Skeleton.Item>
        <button type="button">Reply</button>
      </Skeleton.Item>
    </Skeleton.Content>
  </Skeleton.Root>
)

describe("Skeleton hydration", () => {
  it.each([true, false])("loading=%s hydrates cleanly with the same attributes", async (l) => {
    const { calls, before, after } = await hydrate(tree(l))
    expect(calls).toEqual([])
    expect(after).toBe(before)
  })
})
