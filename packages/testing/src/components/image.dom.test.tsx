// Image scenarios that need no image to load (openspec image): names per status, decorative
// images, a missing alt, attributes. Runs in jsdom and in real browsers; the load statuses
// are in image.browser.test.tsx (jsdom never loads images, so beyond `idle` needs a browser).
import { Image } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getImage } from "../index"

afterEach(() => vi.restoreAllMocks())

const violations = async () =>
  (
    await axe.run(document.body, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
  ).violations.map((v) => v.id)

describe("Image names", () => {
  it("no source: Root is the one image, named by alt; the Fallback is not exposed", async () => {
    render(
      <Image.Root alt="A red bicycle">
        <Image.Img />
        <Image.Fallback>Image unavailable</Image.Fallback>
      </Image.Root>,
    )
    const imgs = screen.getAllByRole("img")
    expect(imgs).toHaveLength(1)
    expect(imgs[0]?.getAttribute("data-part")).toBe("root")
    const i = getImage(screen, { name: "A red bicycle" })
    expect(await i.status()).toBe("idle")
    expect(await i.name()).toBe("A red bicycle")
    expect(await i.isFallbackVisible()).toBe(true)
    expect(screen.queryByText("Image unavailable")?.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(await violations()).toEqual([])
  })

  it("no Fallback rendered: Root still carries the name", () => {
    render(
      <Image.Root alt="A red bicycle">
        <Image.Img />
      </Image.Root>,
    )
    expect(screen.getByRole("img", { name: "A red bicycle" }).getAttribute("data-part")).toBe(
      "root",
    )
  })

  it("inside a link: the link is named by alt", () => {
    render(
      <a href="#bike">
        <Image.Root alt="A red bicycle">
          <Image.Img />
        </Image.Root>
      </a>,
    )
    expect(screen.getByRole("link", { name: "A red bicycle" })).toBeTruthy()
  })

  it('decorative (alt=""): nothing exposed, data-decorative, no error', async () => {
    const error = vi.spyOn(console, "error")
    const { container } = render(
      <div data-testid="row">
        <Image.Root alt="">
          <Image.Img />
          <Image.Fallback>…</Image.Fallback>
        </Image.Root>
      </div>,
    )
    expect(screen.queryByRole("img")).toBeNull()
    expect(container.querySelector('[data-part="root"]')?.hasAttribute("data-decorative")).toBe(
      true,
    )
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("")
    expect(await getImage(screen, { within: screen.getByTestId("row") }).status()).toBe("idle")
    expect(error).not.toHaveBeenCalled()
    expect(await violations()).toEqual([])
  })

  it("missing alt (untyped caller): a development error, no alt attribute, axe reports it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    // An untyped JavaScript caller: the types require alt.
    const Untyped = Image.Root as unknown as (p: { children: React.ReactNode }) => React.ReactNode
    const { container } = render(
      <Untyped>
        <Image.Img src="/bike.jpg" />
      </Untyped>,
    )
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/no alt.*alt=""/))
    expect(container.querySelector("img")?.hasAttribute("alt")).toBe(false)
    expect(await violations()).toContain("image-alt")
  })
})

describe("image attributes", () => {
  it("no source: idle, <img> hidden with no src attribute, every part data-state idle", () => {
    const { container } = render(
      <Image.Root alt="A red bicycle">
        <Image.Img src="" />
        <Image.Fallback>…</Image.Fallback>
      </Image.Root>,
    )
    const img = container.querySelector("img") as HTMLImageElement
    expect(img.hidden).toBe(true)
    expect(img.hasAttribute("src")).toBe(false)
    for (const el of container.querySelectorAll("[data-scope=image]")) {
      expect(el.getAttribute("data-state")).toBe("idle")
    }
  })

  it("a source: the <img> is not hidden while loading, src after srcSet, sizes, loading", () => {
    const { container } = render(
      <Image.Root alt="A red bicycle">
        <Image.Img
          src="/bike.jpg"
          srcSet="/bike-2x.jpg 2x"
          sizes="100vw"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </Image.Root>,
    )
    const img = container.querySelector("img") as HTMLImageElement
    expect(img.hidden).toBe(false)
    expect(img.getAttribute("decoding")).toBe("async")
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer")
    const names = img.getAttributeNames()
    for (const before of ["srcset", "sizes", "loading"]) {
      expect(names.indexOf(before)).toBeLessThan(names.indexOf("src"))
    }
  })

  it("no default loading attribute (the browser default applies)", () => {
    const { container } = render(
      <Image.Root alt="A red bicycle">
        <Image.Img src="/bike.jpg" />
      </Image.Root>,
    )
    expect(container.querySelector("img")?.hasAttribute("loading")).toBe(false)
  })

  it("consumer data-variant, data-size, data-tone pass through; no inline style", () => {
    const { container } = render(
      <Image.Root alt="A red bicycle" data-variant="x" data-size="y" data-tone="z">
        <Image.Img />
      </Image.Root>,
    )
    const root = container.querySelector('[data-part="root"]') as HTMLElement
    expect(root.dataset["variant"]).toBe("x")
    expect(root.dataset["size"]).toBe("y")
    expect(root.dataset["tone"]).toBe("z")
    for (const el of container.querySelectorAll("[data-scope=image]")) {
      expect(el.hasAttribute("style")).toBe(false)
    }
  })

  it("two Img parts: a development warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Image.Root alt="A red bicycle">
        <Image.Img />
        <Image.Img />
      </Image.Root>,
    )
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/more than one Image.Img/))
  })

  it("Img outside Root throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Image.Img />)).toThrow(/inside Image.Root/)
  })
})
