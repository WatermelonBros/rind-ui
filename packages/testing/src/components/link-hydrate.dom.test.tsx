// Server markup hydrates with no mismatch warning, for every link flavour.
import { Link, RouterProvider } from "@rind-ui/react"
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
  await act(async () => root?.unmount())
  container.remove()
  return calls
}

describe("Link hydration", () => {
  const trees: Record<string, () => ReactNode> = {
    enabled: () => <Link href="/a">A</Link>,
    disabled: () => (
      <Link href="/a" disabled>
        A
      </Link>
    ),
    current: () => (
      <Link href="/a" current="page">
        A
      </Link>
    ),
    external: () => (
      <Link href="https://example.org/x" target="_blank">
        A
      </Link>
    ),
    "router with a basename": () => (
      <RouterProvider navigate={() => {}} href={(h) => `/app${h}`}>
        <Link href="/a">A</Link>
      </RouterProvider>
    ),
    "div fallback": () => (
      <Link href="/a" render={<div />}>
        A
      </Link>
    ),
  }

  it.each(Object.entries(trees))("%s: zero console errors or warnings", async (name, tree) => {
    const calls = await hydrate(tree())
    // The div fallback warns once in development that it loses the browser's link features.
    const unexpected = calls.filter(
      (c) => !(name === "div fallback" && /link features/.test(String(c[0]))),
    )
    expect(unexpected).toEqual([])
  })
})

describe("data-external across hydration", () => {
  it("a same-origin absolute URL hydrates without a mismatch and is not external", async () => {
    const tree = (
      <>
        <Link href={`${location.origin}/x`}>Same</Link>
        <Link href="https://example.org/x">Other</Link>
      </>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    // The server cannot know the origin: neither link is marked yet.
    expect(container.querySelectorAll("[data-external]")).toHaveLength(0)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
    const [same, other] = container.querySelectorAll("a")
    expect(same?.hasAttribute("data-external")).toBe(false)
    expect(other?.hasAttribute("data-external")).toBe(true)
    await act(async () => root?.unmount())
    container.remove()
  })
})
