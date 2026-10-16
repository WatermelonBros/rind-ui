import { afterEach, describe, expect, it, vi } from "vitest"
import { skeletonConnect, warnStatusPlacement } from "./skeleton.connect"

afterEach(() => vi.restoreAllMocks())

const loading = skeletonConnect({ instance: "i", loading: true, animate: true })
const loaded = skeletonConnect({ instance: "i", loading: false, animate: true })

describe("skeleton connect", () => {
  it("Root: scope attributes and data-state only, no ARIA", () => {
    expect(loading.root()).toEqual({
      "data-scope": "skeleton",
      "data-part": "root",
      "data-instance": "i",
      "data-state": "loading",
    })
    expect(loaded.root()["data-state"]).toBe("loaded")
  })

  it("Content: aria-busy only while loading", () => {
    expect(loading.content()["aria-busy"]).toBe("true")
    expect(loaded.content()["aria-busy"]).toBeUndefined()
  })

  it("Status: visually hidden while loading, nothing when loaded; never a live region", () => {
    const s = loading.status()
    expect(s?.["style"]).toMatchObject({ position: "fixed", width: "1px" })
    expect(s?.["role"]).toBeUndefined()
    expect(s?.["aria-live"]).toBeUndefined()
    expect(loaded.status()).toBeNull()
  })

  it("Item: hidden, animated; inert only with children (kobaltedev/kobalte#453: present-empty)", () => {
    expect(loading.item({ hasChildren: false })).toMatchObject({
      "aria-hidden": "true",
      inert: undefined,
      "data-animate": "",
      "data-state": "loading",
    })
    expect(loading.item({ hasChildren: true })["inert"]).toBe(true)
    expect(loading.item({ hasChildren: false })["role"]).toBeUndefined()
  })

  it("Item when loaded: nothing but scoping and data-state", () => {
    const p = loaded.item({ hasChildren: true })
    expect(p["aria-hidden"]).toBeUndefined()
    expect(p["inert"]).toBeUndefined()
    expect(p["data-animate"]).toBeUndefined()
    expect(p["data-state"]).toBe("loaded")
  })

  it("Item overrides: loading and animate", () => {
    expect(loaded.item({ hasChildren: false, loading: true })["aria-hidden"]).toBe("true")
    expect(loading.item({ hasChildren: false, loading: false })["aria-hidden"]).toBeUndefined()
    expect(loading.item({ hasChildren: false, animate: false })["data-animate"]).toBeUndefined()
    const still = skeletonConnect({ instance: "i", loading: true, animate: false })
    expect(still.item({ hasChildren: false })["data-animate"]).toBeUndefined()
    expect(still.item({ hasChildren: false, animate: true })["data-animate"]).toBe("")
  })

  it("no part writes an inline style except Status's visually hidden one", () => {
    for (const p of [loading.root(), loading.content(), loading.item({ hasChildren: true })]) {
      expect(p["style"]).toBeUndefined()
    }
  })

  it("warns when Status is inside Content", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    warnStatusPlacement({ closest: () => null })
    expect(warn).not.toHaveBeenCalled()
    warnStatusPlacement({ closest: () => ({}) })
    expect(warn.mock.calls[0]?.[0]).toMatch(/outside Content/)
  })
})
