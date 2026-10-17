// Server markup hydrates with no warning and the same attributes, under a provider locale
// (range-value "Same text on server and client", BU#4616).
import { Meter, RindProvider } from "@rind-ui/react"
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

const tree = (value: number) => (
  <RindProvider locale="fr-FR">
    <Meter.Root value={value} low={20} high={80} optimum={100}>
      <Meter.Label>Batterie</Meter.Label>
      <Meter.ValueText />
      <Meter.Track>
        <Meter.Indicator />
      </Meter.Track>
    </Meter.Root>
  </RindProvider>
)

describe("Meter hydration", () => {
  it.each([10, 50, 90])("value=%s hydrates cleanly with the same markup", async (v) => {
    const { calls, before, after } = await hydrate(tree(v))
    expect(calls).toEqual([])
    expect(after).toBe(before)
    // innerHTML may serialise the no-break space as an entity.
    expect(before).toMatch(/aria-valuetext="\d+(\s|&nbsp;)%"/u)
    expect(before).toContain('role="presentation"')
  })
})
