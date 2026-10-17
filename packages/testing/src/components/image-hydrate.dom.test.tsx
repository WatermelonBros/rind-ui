// Server markup hydrates with no warning, with and without fallbackDelay (task 3.2). The
// cached-image hydration case needs a real browser: image.browser.test.tsx.
import { Image } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (delay: number, src?: string) => (
  <StrictMode>
    <Image.Root alt="A red bicycle" fallbackDelay={delay}>
      <Image.Img src={src} />
      <Image.Fallback>Image unavailable</Image.Fallback>
    </Image.Root>
  </StrictMode>
)

describe("Image hydration", () => {
  it.each([
    ["no source, delay 0", 0, undefined],
    ["no source, delay 300", 300, undefined],
    ["source, delay 0", 0, "/bike.jpg"],
    ["source, delay 300", 300, "/bike.jpg"],
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
    for (const el of container.querySelectorAll("[data-scope=image]")) {
      expect(el.getAttribute("data-instance")).toBe(instance)
    }
    // No source: the server HTML already hides the <img> (chakra-ui#4648: no one-frame flash).
    if (src === undefined) {
      expect((container.querySelector("img") as HTMLImageElement).hidden).toBe(true)
      expect(container.textContent).toContain("Image unavailable")
    }
    await act(async () => root?.unmount())
    container.remove()
  })

  it("remounted with no source: the first render already hides the <img>", () => {
    const html = renderToString(
      <Image.Root alt="A red bicycle">
        <Image.Img />
      </Image.Root>,
    )
    expect(html).toMatch(/<img[^>]*hidden/)
    expect(html).toMatch(/role="img"[^>]*aria-label="A red bicycle"/)
  })
})
