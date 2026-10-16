// Server markup hydrates with no warning, with and without fallbackDelay (task 3.2). The
// cached-image hydration case needs a real browser: avatar.browser.test.tsx.
import { Avatar } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (delay: number, src?: string) => (
  <StrictMode>
    <Avatar.Root aria-label="Ada Lovelace" fallbackDelay={delay}>
      <Avatar.Image src={src} />
      <Avatar.Fallback>AL</Avatar.Fallback>
    </Avatar.Root>
  </StrictMode>
)

describe("Avatar hydration", () => {
  it.each([
    ["no source, delay 0", 0, undefined],
    ["no source, delay 300", 300, undefined],
    ["source, delay 0", 0, "/a.png"],
    ["source, delay 300", 300, "/a.png"],
  ])("%s: no hydration warning, ids from the root id", async (_, delay, src) => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree(delay, src))
    document.body.append(container)
    const instance = container.querySelector('[data-part="root"]')?.getAttribute("data-instance")
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree(delay, src), {
        onRecoverableError: (e) => error(String(e)),
      })
    })
    expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
    for (const el of container.querySelectorAll("[data-scope=avatar]")) {
      expect(el.getAttribute("data-instance")).toBe(instance)
    }
    // No source: the fallback shows after the first commit, whatever the delay.
    if (src === undefined) expect(container.textContent).toContain("AL")
    await act(async () => root?.unmount())
    container.remove()
  })
})
