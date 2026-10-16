// image-loading-status and Avatar in real browsers (tasks 1.1, 3.2, 4.2): the rendered <img>
// is the loader. Fixtures: a data URL, an SVG file, an SVG without intrinsic size, a 404.
// The slow image (a route held until the test releases it) is in fixtures/avatar/avatar.pw.test.ts.
import { imageSettled } from "@rind-ui/core"
import { Avatar, type AvatarRootProps } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { StrictMode, useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getAvatar } from "../index"

afterEach(() => vi.restoreAllMocks())

const DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
const FACE = "/packages/testing/fixtures/avatar/face.svg"
const NO_SIZE = "/packages/testing/fixtures/avatar/no-size.svg"
const MISSING = "/packages/testing/fixtures/avatar/missing.png"
const fresh = (url: string) => `${url}?${Math.random()}`

function Ada({ src, ...props }: AvatarRootProps & { src?: string | undefined }) {
  return (
    <Avatar.Root aria-label="Ada Lovelace" {...props}>
      <Avatar.Image src={src} />
      <Avatar.Fallback>AL</Avatar.Fallback>
    </Avatar.Root>
  )
}
const ada = () => getAvatar(screen, { name: "Ada Lovelace" })

async function loadImg(src: string) {
  const img = document.createElement("img")
  img.src = src
  document.body.append(img)
  await new Promise((r) => {
    img.onload = r
    img.onerror = r
  })
  return img
}

describe("imageSettled (core/dom/image-status)", () => {
  it("a loaded data URL is loaded", async () => {
    const img = await loadImg(DATA)
    expect(imageSettled(img)).toBe("loaded")
    img.remove()
  })

  it("a 404 is complete with no width: decode() rejects → error", async () => {
    const img = await loadImg(fresh(MISSING))
    expect(await imageSettled(img)).toBe("error")
    img.remove()
  })

  it("an SVG without intrinsic size is loaded (via naturalWidth or decode())", async () => {
    const img = await loadImg(fresh(NO_SIZE))
    expect(await imageSettled(img)).toBe("loaded")
    img.remove()
  })

  it("an image not yet complete is loading", () => {
    const img = document.createElement("img")
    img.src = fresh(FACE)
    expect(imageSettled(img)).toBe("loading")
  })
})

describe("load and error", () => {
  it("load succeeds: loading → loaded, one onStatusChange with reason IMAGE.LOAD", async () => {
    const calls: [string, string][] = []
    render(<Ada src={fresh(FACE)} onStatusChange={(s, d) => calls.push([s, d.reason])} />)
    await ada().waitForStatus("loaded")
    expect(calls.at(-1)).toEqual(["loaded", "IMAGE.LOAD"])
    expect(calls.filter(([s]) => s === "loaded")).toHaveLength(1)
    expect(await ada().isFallbackVisible()).toBe(false)
  })

  it("data URL: loaded in the registering commit, no loading callback", async () => {
    await loadImg(DATA) // decoded and cached
    const calls: string[] = []
    render(<Ada src={DATA} onStatusChange={(s) => calls.push(s)} />)
    await ada().waitForStatus("loaded")
    expect(calls).toEqual(["loaded"])
  })

  it("error: Root, Image and Fallback data-state error, Image hidden, consumer onError once", async () => {
    const onError = vi.fn()
    const { container } = render(
      <Avatar.Root aria-label="Ada Lovelace">
        <Avatar.Image src={fresh(MISSING)} onError={onError} />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    )
    await ada().waitForStatus("error")
    for (const part of ["root", "image", "fallback"]) {
      expect(container.querySelector(`[data-part="${part}"]`)?.getAttribute("data-state")).toBe(
        "error",
      )
    }
    expect((container.querySelector("img") as HTMLImageElement).hidden).toBe(true)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(await ada().name()).toBe("Ada Lovelace")
  })

  it("SVG without intrinsic size reaches loaded, not error", async () => {
    render(<Ada src={fresh(NO_SIZE)} />)
    await ada().waitForStatus("loaded")
  })

  it("name stays the same in loading, loaded and error", async () => {
    const { rerender } = render(<Ada src={fresh(FACE)} />)
    expect(await ada().name()).toBe("Ada Lovelace")
    await ada().waitForStatus("loaded")
    expect(await ada().name()).toBe("Ada Lovelace")
    rerender(<Ada src={fresh(MISSING)} />)
    await ada().waitForStatus("error")
    expect(await ada().name()).toBe("Ada Lovelace")
    expect(screen.queryByRole("img", { name: "AL" })).toBeNull()
  })
})

describe("source changes", () => {
  it("prop step src → undefined: idle and the Fallback is back (radix#1767)", async () => {
    const { rerender } = render(<Ada src={DATA} />)
    await ada().waitForStatus("loaded")
    rerender(<Ada src={undefined} />)
    expect(await ada().status()).toBe("idle")
    expect(await ada().isFallbackVisible()).toBe(true)
  })

  it("Image unmounted: idle and the Fallback is back", async () => {
    const { rerender } = render(<Ada src={DATA} />)
    await ada().waitForStatus("loaded")
    rerender(
      <Avatar.Root aria-label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    )
    await ada().waitForStatus("idle")
    expect(await ada().isFallbackVisible()).toBe(true)
  })

  it("retry by changing src (radix#2892): error → loading → loaded", async () => {
    const statuses: string[] = []
    const { rerender } = render(
      <Ada src={fresh(MISSING)} onStatusChange={(s) => statuses.push(s)} />,
    )
    await ada().waitForStatus("error")
    rerender(<Ada src={fresh(FACE)} onStatusChange={(s) => statuses.push(s)} />)
    await ada().waitForStatus("loaded")
    expect(statuses.slice(-2)).toEqual(["loading", "loaded"])
  })

  it("no source → hidden; a source removes hidden while loading", async () => {
    const { container, rerender } = render(<Ada src={undefined} />)
    const img = () => container.querySelector("img") as HTMLImageElement
    expect(img().hidden).toBe(true)
    rerender(<Ada src={fresh(FACE)} />)
    expect(img().hidden).toBe(false)
  })

  it("load after unmount (bits-ui#2050): nothing updated, nothing logged", async () => {
    const warn = vi.spyOn(console, "warn")
    const error = vi.spyOn(console, "error")
    const { container, unmount } = render(<Ada src={fresh(FACE)} />)
    const img = container.querySelector("img") as HTMLImageElement
    unmount()
    // The detached image still loads: wait for its own load event, not for a delay.
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }))
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })
})

describe("fallback timing", () => {
  it("no image waits for nothing (base-ui#5988)", async () => {
    render(<Ada src={undefined} fallbackDelay={1000} />)
    await waitFor(() => expect(screen.getByText("AL")).toBeTruthy(), { timeout: 200 })
  })

  it("failed image does not wait for the delay", async () => {
    render(<Ada src={fresh(MISSING)} fallbackDelay={5000} />)
    await ada().waitForStatus("error")
    expect(await ada().isFallbackVisible()).toBe(true)
  })
})

describe("server rendering and hydration", () => {
  async function hydrate(tree: React.ReactElement, settle?: (c: HTMLElement) => Promise<void>) {
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const html = container.innerHTML
    await settle?.(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    return { container, html, error, unmount: () => act(async () => root?.unmount()) }
  }

  it("server HTML has the <img> with its src and the Fallback (delay 0)", () => {
    const html = renderToString(<Ada src={FACE} />)
    const img = /<img[^>]*>/.exec(html)?.[0] ?? ""
    expect(img).toContain(`src="${FACE}"`)
    // Lazy-safe: an <img> with a source is never hidden in the server HTML, or a
    // loading="lazy" image could not load before hydration.
    expect(img).not.toMatch(/\shidden(=|\s|>|\/)/)
    expect(html).toContain("AL")
  })

  it("server HTML of a lazy image keeps it visible; no source → hidden", () => {
    const lazy = /<img[^>]*>/.exec(
      renderToString(
        <Avatar.Root aria-label="Ada Lovelace">
          <Avatar.Image src={FACE} loading="lazy" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>,
      ),
    )?.[0]
    expect(lazy).toContain('loading="lazy"')
    expect(lazy).not.toMatch(/\shidden(=|\s|>|\/)/)
    const none = /<img[^>]*>/.exec(renderToString(<Ada src={undefined} />))?.[0]
    expect(none).toMatch(/\shidden(=|\s|>|\/)/)
  })

  it("fallbackDelay > 0: no Fallback in server HTML", () => {
    expect(renderToString(<Ada src={FACE} fallbackDelay={300} />)).not.toContain("AL")
  })

  it("cached image on hydration (base-ui#4468): first status loaded, fallback gone, no warning", async () => {
    const calls: [string, string][] = []
    const src = fresh(FACE)
    const tree = (
      <StrictMode>
        <Ada src={src} onStatusChange={(s, d) => calls.push([s, d.reason])} />
      </StrictMode>
    )
    const { container, error, unmount } = await hydrate(tree, async (c) => {
      const img = c.querySelector("img") as HTMLImageElement
      if (!img.complete) await new Promise((r) => (img.onload = r))
    })
    expect(calls[0]).toEqual(["loaded", "IMAGE.MOUNT"])
    expect(container.querySelector('[data-part="fallback"]')).toBeNull()
    expect(container.querySelector('[data-part="root"]')?.getAttribute("data-state")).toBe("loaded")
    expect(error).not.toHaveBeenCalled()
    await unmount()
  })

  it("broken image finished before hydration: error after hydration", async () => {
    const src = fresh(MISSING)
    const { container, unmount } = await hydrate(<Ada src={src} />, async (c) => {
      const img = c.querySelector("img") as HTMLImageElement
      if (!img.complete) await new Promise((r) => (img.onerror = r))
    })
    await waitFor(() =>
      expect(container.querySelector('[data-part="root"]')?.getAttribute("data-state")).toBe(
        "error",
      ),
    )
    await unmount()
  })

  it("Strict Mode client render reaches loaded", async () => {
    render(
      <StrictMode>
        <Ada src={fresh(FACE)} />
      </StrictMode>,
    )
    await ada().waitForStatus("loaded")
  })
})

describe("element substitution", () => {
  function CustomImage(props: React.ComponentProps<"img">) {
    // A framework image component: re-renders on its own, rewrites nothing.
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

  it("custom image component through render (ark#4108): in the DOM, reaches loaded", async () => {
    let renders = 0
    render(
      <Avatar.Root aria-label="Ada Lovelace">
        <Avatar.Image
          src={fresh(FACE)}
          render={(props) => {
            renders++
            return <CustomImage {...props} />
          }}
        />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    )
    expect(document.querySelector("img")).not.toBeNull()
    await ada().waitForStatus("loaded")
    // ark#3426: a bounded number of renders while the image loads.
    expect(renders).toBeLessThan(10)
  })

  it("lazy image below the fold loads only near the viewport (radix#2512)", async () => {
    // The test page has loaded many modules: make room in the resource timing buffer.
    performance.clearResourceTimings()
    const src = fresh(FACE)
    const eager = fresh(FACE)
    const { container } = render(
      <div>
        {/* A control: once this eager image has loaded, the lazy one had its chance too. */}
        <img src={eager} alt="" data-testid="eager" />
        <div style={{ height: 5000 }} />
        <Avatar.Root aria-label="Ada Lovelace">
          <Avatar.Image src={src} loading="lazy" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </div>,
    )
    const control = container.querySelector('[data-testid="eager"]') as HTMLImageElement
    if (!control.complete) {
      await new Promise((r) => control.addEventListener("load", r, { once: true }))
    }
    const requested = () =>
      performance.getEntriesByType("resource").some((e) => e.name.endsWith(src.slice(1)))
    expect(requested()).toBe(false)
    expect(await ada().status()).toBe("loading")
    container.querySelector('[data-part="image"]')?.scrollIntoView()
    await ada().waitForStatus("loaded")
    expect(requested()).toBe(true)
  })
})
