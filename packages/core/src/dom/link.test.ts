// Link attribute and href rules that need no DOM (openspec link-navigation). Each bug cited
// in the spec has a named case.
import { describe, expect, it, vi } from "vitest"
import type { ModalityEnv } from "../env/capabilities"
import type { Router } from "../env/router"
import { type LinkCurrent, type LinkEnv, type LinkInput, linkProps, resolveHref } from "./link"
import { platforms } from "./platform"

const modality: ModalityEnv["modality"] = {
  modality: () => "pointer",
  subscribe: () => () => {},
  focusCause: () => "other",
  markFocus: () => {},
  unmarkFocus: () => {},
  recentFocus: () => [],
}
const envOf = (router?: Router): LinkEnv => ({
  platform: platforms.linux,
  modality,
  ...(router ? { router } : {}),
})
const basename: Router = { navigate: () => {}, href: (h) => `/base${h}` }

describe("resolveHref", () => {
  const cases: [string, string, string][] = [
    // value, without mapping, with mapping `/base${h}`
    ["a", "a", "/basea"],
    ["/a", "/a", "/base/a"],
    ["https://x", "https://x", "https://x"],
    ["mailto:x", "mailto:x", "mailto:x"],
    ["tel:1", "tel:1", "tel:1"],
    ["//cdn.x/y", "//cdn.x/y", "//cdn.x/y"],
  ]
  it.each(cases)("%s", (value, plain, mapped) => {
    expect(resolveHref(value, {})).toBe(plain)
    expect(resolveHref(value, { router: { navigate: () => {} } })).toBe(plain)
    expect(resolveHref(value, { router: basename })).toBe(mapped)
  })

  it("never rewrites external URLs, mailto or tel (react-spectrum#6397, #6803, #5335)", () => {
    for (const v of ["https://example.org/x", "mailto:a@b.c", "tel:+1", "HTTP://X"]) {
      expect(resolveHref(v, { router: basename })).toBe(v)
    }
  })
})

describe("router.href is called only for parts with an href (react-spectrum#9490)", () => {
  it("not at all without href, once with one", () => {
    const href = vi.fn((h: string) => `/base${h}`)
    const env = envOf({ navigate: () => {}, href })
    linkProps({ tag: "a" }, env)
    linkProps({ tag: "div", disabled: true }, env)
    expect(href).not.toHaveBeenCalled()
    linkProps({ tag: "a", href: "/a" }, env)
    expect(href).toHaveBeenCalledOnce()
  })

  it("not for a disabled link, which renders no href", () => {
    const href = vi.fn((h: string) => h)
    linkProps({ tag: "a", href: "/a", disabled: true }, envOf({ navigate: () => {}, href }))
    expect(href).not.toHaveBeenCalled()
  })
})

describe("linkProps attributes", () => {
  const tags = ["a", "div", "span"] as const
  const disabledValues = [false, true] as const
  const focusable = [false, true] as const
  const currents: LinkCurrent[] = [true, "page", "step", "location", "date", "time", false]

  const rows = tags.flatMap((tag) =>
    disabledValues.flatMap((disabled) =>
      focusable.flatMap((focusableWhenDisabled) =>
        [...currents, undefined].map((current) => ({
          tag,
          disabled,
          focusableWhenDisabled,
          current,
        })),
      ),
    ),
  )

  it.each(rows)("%o", ({ tag, disabled, focusableWhenDisabled, current }) => {
    const input: LinkInput = { tag, href: "/a", disabled, focusableWhenDisabled, current }
    const p = linkProps(input, envOf(basename))

    // Native Anchor By Default / Non-Anchor Fallback / Disabled Links
    if (disabled) {
      expect(p["href"]).toBeUndefined()
      expect(p["role"]).toBe("link")
      expect(p["aria-disabled"]).toBe("true")
      expect(p["tabindex"]).toBe(focusableWhenDisabled ? 0 : -1)
      expect(p["data-disabled"]).toBe("")
    } else {
      expect(p["aria-disabled"]).toBeUndefined()
      expect(p["data-disabled"]).toBeUndefined()
      if (tag === "a") {
        expect(p["href"]).toBe("/base/a")
        expect(p["role"]).toBeUndefined()
        expect(p["tabindex"]).toBeUndefined()
      } else {
        expect(p["role"]).toBe("link")
        expect(p["tabindex"]).toBe(0)
      }
    }

    // Current Link
    if (current === undefined || current === false) {
      expect(p["aria-current"]).toBeUndefined()
      expect(p["data-current"]).toBeUndefined()
    } else {
      expect(p["aria-current"]).toBe(current === true ? "true" : current)
      expect(p["data-current"]).toBe("")
    }
  })

  it("a current link keeps its href", () => {
    const p = linkProps({ tag: "a", href: "/a", current: "page" }, envOf())
    expect(p["href"]).toBe("/a")
    expect(p["aria-current"]).toBe("page")
  })

  it("accepts current through the typed input (react-spectrum#10572)", () => {
    const p = linkProps({ href: "/a", current: "location", tag: "a" }, envOf())
    expect(p["aria-current"]).toBe("location")
  })

  it("passes target, rel, download, ping, referrerPolicy and hrefLang to an anchor only", () => {
    const input: LinkInput = {
      tag: "a",
      href: "/a",
      target: "_blank",
      rel: "noopener",
      download: true,
      ping: "/p",
      referrerPolicy: "no-referrer",
      hrefLang: "it",
    }
    const p = linkProps(input, envOf())
    expect([
      p["target"],
      p["rel"],
      p["download"],
      p["ping"],
      p["referrerpolicy"],
      p["hreflang"],
    ]).toEqual(["_blank", "noopener", "", "/p", "no-referrer", "it"])
    const off = linkProps({ ...input, disabled: true }, envOf())
    expect(off["target"]).toBeUndefined()
    expect(off["download"]).toBeUndefined()
    expect(linkProps({ ...input, tag: "div" }, envOf())["target"]).toBeUndefined()
  })
})

describe("data-external without a document", () => {
  const external = (href: string, tag = "a") => linkProps({ tag, href }, envOf())["data-external"]
  it("is set for a non-http(s) scheme, which needs no origin", () => {
    expect(external("mailto:a@b.c")).toBe("")
    expect(external("tel:123")).toBe("")
  })
  it("is undecided (absent) for an http(s) URL until the origin is known (hydration)", () => {
    expect(external("https://example.org/x")).toBeUndefined()
    expect(external("//cdn.x/y")).toBeUndefined()
  })
  it("compares origins once the origin is known", () => {
    const withOrigin = (href: string) =>
      linkProps({ tag: "a", href, origin: "https://app.test" }, envOf())["data-external"]
    expect(withOrigin("https://app.test/x")).toBeUndefined()
    expect(withOrigin("https://example.org/x")).toBe("")
    expect(withOrigin("//cdn.x/y")).toBe("")
  })
  it("is absent for relative and root-relative values", () => {
    expect(external("a")).toBeUndefined()
    expect(external("/a")).toBeUndefined()
  })
  it("is absent for a disabled link or without href", () => {
    expect(
      linkProps({ tag: "a", href: "https://x.org", disabled: true }, envOf())["data-external"],
    ).toBeUndefined()
    expect(linkProps({ tag: "a" }, envOf())["data-external"]).toBeUndefined()
  })
})
