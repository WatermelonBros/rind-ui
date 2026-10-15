// Server markup hydrates with no mismatch warning, for every Button flavour (3.2).
import { Button } from "@rind-ui/react"
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
  const el = container.firstElementChild
  await act(async () => root?.unmount())
  container.remove()
  return { calls, el }
}

describe("Button hydration", () => {
  const trees: Record<string, () => ReactNode> = {
    enabled: () => <Button>Save</Button>,
    disabled: () => <Button disabled>Save</Button>,
    "focusable when disabled": () => (
      <Button disabled focusableWhenDisabled>
        Save
      </Button>
    ),
    pending: () => (
      <Button type="submit" pending>
        Save
      </Button>
    ),
    "render <a href>": () => <Button render={<a href="/docs" />}>Docs</Button>,
    "disabled <a href>": () => (
      <Button render={<a href="/docs" />} disabled>
        Docs
      </Button>
    ),
    "render <div>": () => <Button render={<div />}>Div</Button>,
  }

  it.each(Object.entries(trees))("%s: zero console errors or warnings", async (_n, tree) => {
    const { calls } = await hydrate(tree())
    expect(calls).toEqual([])
  })

  it("a hydrated <div> carries role and tabindex", async () => {
    const { el } = await hydrate(<Button render={<div />}>Div</Button>)
    expect(el?.getAttribute("role")).toBe("button")
    expect(el?.getAttribute("tabindex")).toBe("0")
  })
})
