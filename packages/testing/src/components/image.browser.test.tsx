// Image in real browsers (tasks 3.2, 4.2): the name moves between the <img> and Root with
// the status but keeps its text, the ratio box survives an error, the cached image paints
// with no fallback frame after hydration, lazy images keep their fallback. Fixtures are
// Avatar's (data URL, SVG file, 404); the held "slow" image is in fixtures/image.
import { Image, type ImageRootProps } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { StrictMode, useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getImage } from "../index"
import { spokenLog } from "../virtual-sr"

afterEach(() => vi.restoreAllMocks())

const DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
const FACE = "/packages/testing/fixtures/avatar/face.svg"
const MISSING = "/packages/testing/fixtures/avatar/missing.png"
const fresh = (url: string) => `${url}?${Math.random()}`

function Bike({
  src,
  loading,
  ...props
}: Omit<ImageRootProps, "alt"> & {
  src?: string | undefined
  loading?: "lazy" | "eager"
  alt?: string
}) {
  return (
    <Image.Root alt="A red bicycle" {...props}>
      <Image.Img src={src} {...(loading ? { loading } : {})} />
      <Image.Fallback>Image unavailable</Image.Fallback>
    </Image.Root>
  )
}
const bike = () => getImage(screen, { name: "A red bicycle" })

describe("one name in every status", () => {
  it("loaded: the <img> is the one image, named by alt; Root has no role", async () => {
    render(<Bike src={DATA} />)
    await bike().waitForStatus("loaded")
    const imgs = screen.getAllByRole("img")
    expect(imgs).toHaveLength(1)
    expect(imgs[0]?.tagName).toBe("IMG")
    expect(await bike().name()).toBe("A red bicycle")
    expect(await bike().isFallbackVisible()).toBe(false)
  })

  it("error: the same driver locates Root, named by alt; the Fallback text is not exposed", async () => {
    render(<Bike src={fresh(MISSING)} />)
    const i = bike()
    await i.waitForStatus("error")
    const imgs = screen.getAllByRole("img")
    expect(imgs).toHaveLength(1)
    expect(imgs[0]?.getAttribute("data-part")).toBe("root")
    expect(await i.name()).toBe("A red bicycle")
    expect(screen.queryByRole("img", { name: "Image unavailable" })).toBeNull()
    expect((document.querySelector("img") as HTMLImageElement).hidden).toBe(true)
  })

  it("decorative in error: nothing exposed", async () => {
    render(
      <div data-testid="row">
        <Bike alt="" src={fresh(MISSING)} />
      </div>,
    )
    await getImage(screen, { within: screen.getByTestId("row") }).waitForStatus("error")
    expect(screen.queryByRole("img")).toBeNull()
  })

  it("retry by changing src: error → loading → loaded, one name", async () => {
    const statuses: string[] = []
    const { rerender } = render(
      <Bike src={fresh(MISSING)} onStatusChange={(s) => statuses.push(s)} />,
    )
    await bike().waitForStatus("error")
    rerender(<Bike src={fresh(FACE)} onStatusChange={(s) => statuses.push(s)} />)
    await bike().waitForStatus("loaded")
    expect(statuses.slice(-2)).toEqual(["loading", "loaded"])
    expect(await bike().name()).toBe("A red bicycle")
  })
})

describe("virtual screen reader", () => {
  it("reads the same name loaded and after an error, never the Fallback text", async () => {
    const read = async (src: string, status: "loaded" | "error") => {
      const { container, unmount } = render(<Bike src={src} />)
      await bike().waitForStatus(status)
      const log = await spokenLog(container, (v) => v.next())
      unmount()
      return log.join(" | ")
    }
    const loaded = await read(DATA, "loaded")
    const error = await read(fresh(MISSING), "error")
    for (const log of [loaded, error]) {
      expect(log).toContain("A red bicycle")
      expect(log).not.toContain("Image unavailable")
    }
  })
})

describe("ratio box", () => {
  it("an error keeps Root's 16:9 box (320 × 180) and the Fallback fills it", async () => {
    const style = document.createElement("style")
    style.textContent =
      '[data-scope="image"][data-part="root"]{display:grid}[data-scope="image"][data-part="fallback"]{grid-area:1/1}'
    document.head.append(style)
    render(<Bike src={fresh(MISSING)} style={{ aspectRatio: "16 / 9", width: 320 }} />)
    await bike().waitForStatus("error")
    const root = document.querySelector('[data-part="root"]') as HTMLElement
    const box = root.getBoundingClientRect()
    expect([box.width, box.height]).toEqual([320, 180])
    const fallback = document.querySelector('[data-part="fallback"]') as HTMLElement
    expect(fallback.getBoundingClientRect().height).toBe(180)
    style.remove()
  })
})

describe("server rendering and hydration", () => {
  it("server HTML has the <img> with its src and alt (chakra-ui#462)", () => {
    const html = renderToString(<Bike src={FACE} />)
    expect(html).toMatch(new RegExp(`<img[^>]*alt="A red bicycle"[^>]*src="${FACE}"`))
    // Lazy-safe: an <img> with a source is never hidden in the server HTML.
    expect(/<img[^>]*>/.exec(html)?.[0]).not.toMatch(/\shidden(=|\s|>|\/)/)
    expect(/<img[^>]*>/.exec(renderToString(<Bike src={undefined} />))?.[0]).toMatch(
      /\shidden(=|\s|>|\/)/,
    )
  })

  it("cached image on hydration: first status loaded, no fallback frame, no warning", async () => {
    const calls: [string, string][] = []
    const src = fresh(FACE)
    const tree = (
      <StrictMode>
        <Bike src={src} onStatusChange={(s, d) => calls.push([s, d.reason])} />
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const img = container.querySelector("img") as HTMLImageElement
    if (!img.complete) await new Promise((r) => (img.onload = r))
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(calls[0]).toEqual(["loaded", "IMAGE.MOUNT"])
    expect(container.querySelector('[data-part="fallback"]')).toBeNull()
    expect(error).not.toHaveBeenCalled()
    await act(async () => root?.unmount())
    container.remove()
  })
})

describe("native image features", () => {
  it("a framework image component through render: in the DOM, reaches loaded", async () => {
    function FrameworkImage(props: React.ComponentProps<"img">) {
      const [, setN] = useState(0)
      return (
        <img
          {...props}
          alt={props.alt}
          onLoad={(e) => {
            props.onLoad?.(e)
            setN((n) => n + 1)
          }}
        />
      )
    }
    render(
      <Image.Root alt="A red bicycle">
        <Image.Img src={fresh(FACE)} render={(props) => <FrameworkImage {...props} />} />
      </Image.Root>,
    )
    await bike().waitForStatus("loaded")
    expect(document.querySelector("img")?.getAttribute("alt")).toBe("A red bicycle")
  })

  it("one request for the source (chakra-ui#5285)", async () => {
    performance.clearResourceTimings()
    const src = fresh(FACE)
    render(<Bike src={src} />)
    await bike().waitForStatus("loaded")
    const hits = performance
      .getEntriesByType("resource")
      .filter((e) => e.name.endsWith(src.slice(1)))
    expect(hits).toHaveLength(1)
  })

  it("lazy image below the fold keeps its fallback, loads near the viewport (chakra-ui#7956)", async () => {
    performance.clearResourceTimings()
    const src = fresh(FACE)
    const eager = fresh(FACE)
    const { container } = render(
      <div>
        {/* A control: once this eager image has loaded, the lazy one had its chance too. */}
        <img src={eager} alt="" data-testid="eager" />
        <div style={{ height: 5000 }} />
        <Bike src={src} loading="lazy" />
      </div>,
    )
    const control = container.querySelector('[data-testid="eager"]') as HTMLImageElement
    if (!control.complete) {
      await new Promise((r) => control.addEventListener("load", r, { once: true }))
    }
    const requested = () =>
      performance.getEntriesByType("resource").some((e) => e.name.endsWith(src.slice(1)))
    expect(requested()).toBe(false)
    expect(await bike().status()).toBe("loading")
    expect(await bike().isFallbackVisible()).toBe(true)
    container.querySelector('[data-scope="image"][data-part="img"]')?.scrollIntoView()
    await bike().waitForStatus("loaded")
    expect(requested()).toBe(true)
    expect(await bike().isFallbackVisible()).toBe(false)
  })
})
