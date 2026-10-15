// add-theme-system 2.4 (tone re-points focus) and the theme-variants mechanics: tone and size
// as attributes, in real browsers. Component stylesheets map data-variant themselves.
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { cleanup, indexCss, inject, lengthOf, mount, paint, q, resolve } from "./test-css"

beforeEach(() => {
  inject(indexCss)
  document.documentElement.setAttribute("data-theme", "light")
})
afterEach(cleanup)

const roles = ["solid", "solid-hover", "on-solid", "soft", "soft-hover", "text", "border"]
const tones = ["neutral", "danger", "warning", "success"]

describe("Tone", () => {
  describe.each(["light", "dark"])("%s scheme", (scheme) => {
    it.each(tones)("data-tone=%s re-points the seven accent roles and the focus colour", (tone) => {
      const host = mount(`
        <div id="plain" data-theme="${scheme}"></div>
        <div id="toned" data-theme="${scheme}" data-tone="${tone}"><span id="child"></span></div>`)
      const toned = q(host, "#toned")
      for (const role of roles) {
        expect(paint(toned, `--rind-color-accent-${role}`), role).toBe(
          paint(toned, `--rind-color-${tone}-${role}`),
        )
        expect(paint(q(host, "#child"), `--rind-color-accent-${role}`), `child ${role}`).toBe(
          paint(toned, `--rind-color-${tone}-${role}`),
        )
      }
      // Focus is the accent border: a tone changes it too (var() resolves where declared).
      expect(paint(toned, "--rind-focus-color")).toBe(paint(toned, `--rind-color-${tone}-border`))
      expect(paint(toned, "--rind-focus-color")).not.toBe(
        paint(q(host, "#plain"), "--rind-focus-color"),
      )
      // The untoned sibling is unchanged.
      expect(paint(q(host, "#plain"), "--rind-color-accent-solid")).not.toBe(
        paint(toned, "--rind-color-accent-solid"),
      )
    })
  })

  it("data-tone=danger on a button changes its keyboard focus ring colour", () => {
    const host = mount(`
      <button id="a" data-scope="button" data-part="root" data-focus-visible>a</button>
      <button id="b" data-scope="button" data-part="root" data-tone="danger" data-focus-visible>b</button>`)
    const a = getComputedStyle(q(host, "#a"))
    const b = getComputedStyle(q(host, "#b"))
    expect(b.outlineColor).not.toBe(a.outlineColor)
    expect(b.outlineColor).toBe(paint(q(host, "#b"), "--rind-color-danger-border"))
    expect(a.outlineColor).toBe(paint(q(host, "#a"), "--rind-color-accent-border"))
  })

  it("data-tone=accent (the default) re-points nothing", () => {
    const host = mount(`<div id="a"></div><div id="b" data-tone="accent"></div>`)
    for (const role of roles) {
      expect(paint(q(host, "#b"), `--rind-color-accent-${role}`)).toBe(
        paint(q(host, "#a"), `--rind-color-accent-${role}`),
      )
    }
  })

  it("Destructive confirm: a toned region inside a tenant uses the tenant's danger palette", () => {
    inject(`[data-rind-theme="acme"] { --rind-brand-danger: oklch(0.5 0.2 340) }`)
    const host = mount(`
      <div id="t" data-rind-theme="acme" data-theme="light"><div id="d" data-tone="danger"></div></div>`)
    expect(paint(q(host, "#d"), "--rind-color-accent-solid")).toBe(
      paint(q(host, "#t"), "--rind-color-danger-solid"),
    )
  })

  it("a tone on the scope element itself still wins over the scope's own accent", () => {
    const host = mount(`<div id="s" data-rind-theme="live" data-tone="danger"></div>`)
    inject(`[data-rind-theme="live"] { --rind-brand-accent: oklch(0.55 0.15 150) }`)
    const el = q(host, "#s")
    expect(paint(el, "--rind-color-accent-solid")).toBe(paint(el, "--rind-color-danger-solid"))
    expect(paint(el, "--rind-focus-color")).toBe(paint(el, "--rind-color-danger-border"))
  })
})

describe("Size", () => {
  const control = (el: Element) => ({
    size: resolve(el, "min-height", "--rind-size-control"),
    text: resolve(el, "font-size", "--rind-text-control"),
    space: resolve(el, "padding-left", "--rind-space-control"),
  })

  it("Size cascades into a popup", () => {
    const host = mount(`
      <div id="ref"></div>
      <div id="sm" data-size="sm"><div id="popup"><button id="inner"></button></div></div>
      <div id="md" data-size="md"></div>
      <div id="lg" data-size="lg"></div>`)
    const at = (id: string) => control(q(host, id))
    expect(at("#inner")).toEqual(at("#sm"))
    expect(at("#sm").size).toBe(resolve(q(host, "#ref"), "min-height", "--rind-size-sm"))
    expect(at("#md").size).toBe(resolve(q(host, "#ref"), "min-height", "--rind-size-md"))
    expect(at("#lg").size).toBe(resolve(q(host, "#ref"), "min-height", "--rind-size-lg"))
    expect(at("#sm").text).toBe(resolve(q(host, "#ref"), "font-size", "--rind-text-xs"))
    expect(at("#lg").space).toBe(resolve(q(host, "#ref"), "padding-left", "--rind-space-4"))
  })

  it("an inner data-size overrides an outer one", () => {
    const host = mount(`<div data-size="sm"><div id="in" data-size="lg"></div></div>`)
    expect(lengthOf(q(host, "#in"), "--rind-size-control", "min-height")).toBe(
      lengthOf(q(host, "#in"), "--rind-size-lg", "min-height"),
    )
  })

  it("Small stays a target", () => {
    inject(`[data-rind-theme="compact"] { --rind-brand-density: 0.75 }`)
    const host = mount(`<div data-rind-theme="compact" data-size="sm"><span id="c"></span></div>`)
    expect(lengthOf(q(host, "#c"), "--rind-size-control", "min-height")).toBeGreaterThanOrEqual(24)
  })
})
