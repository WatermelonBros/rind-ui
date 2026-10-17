// Server markup hydrates with no warning and the same attributes, under a provider locale
// (range-value "Same text on server and client", BU#4616).
import { Progress, RindProvider } from "@rind-ui/react"
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

const tree = (value: number | null) => (
  <RindProvider locale="fr-FR">
    <Progress.Root value={value}>
      <Progress.Label>Envoi</Progress.Label>
      <Progress.ValueText />
      <Progress.Track>
        <Progress.Indicator />
      </Progress.Track>
    </Progress.Root>
  </RindProvider>
)

describe("Progress hydration", () => {
  it.each([40, null, 100])("value=%s hydrates cleanly with the same markup", async (v) => {
    const { calls, before, after } = await hydrate(tree(v))
    expect(calls).toEqual([])
    expect(after).toBe(before)
  })
})
