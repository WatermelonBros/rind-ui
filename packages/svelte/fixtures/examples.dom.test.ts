// The copyable Svelte examples (packages/svelte/examples/<slug>/<Name>.svelte, shown on the docs
// site's "Get code" panel): each renders the same markup as the site's React example of the
// same name (apps/site/examples/<slug>.tsx), and passes axe.
import { canonicalHtml } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement, type FunctionComponent } from "react"
import { type Component, flushSync, mount, unmount } from "svelte"
import { describe, expect, it, vi } from "vitest"
import { reactSettled } from "./parity"

const svelte = import.meta.glob<{ default: Component }>("../examples/*/*.svelte")
const react = import.meta.glob<Record<string, unknown>>("../../../apps/site/examples/*.tsx")
// Vite's `import.meta.glob` (the package does not depend on Vite's client types).
declare global {
  interface ImportMeta {
    glob<T>(pattern: string): Record<string, () => Promise<T>>
  }
}

const cases = Object.keys(svelte).map((path) => {
  const [, slug = "", name = ""] = /examples\/([^/]+)\/([^/]+)\.svelte$/.exec(path) ?? []
  return { path, slug, name }
})

const inJsdom = navigator.userAgent.includes("jsdom")
// jsdom's CSS parser drops `background` from the style string Svelte sets on Pin Input's
// overlay input (React sets each property): these are compared in real browsers only.
const browserOnly = new Set(["pin-input"])

describe("Svelte examples", () => {
  it("exist", () => expect(cases.length).toBeGreaterThan(0))

  it.each(cases.filter((c) => !(inJsdom && browserOnly.has(c.slug))))(
    "$slug/$name matches the React example and passes axe",
    async ({ path, slug, name }) => {
      const source = react[`../../../apps/site/examples/${slug}.tsx`]
      if (!source) throw new Error(`no React examples for ${slug}`)
      const Example = (await source())[name] as FunctionComponent | undefined
      if (!Example) throw new Error(`apps/site/examples/${slug}.tsx has no export ${name}`)
      const load = svelte[path]
      if (!load) throw new Error(`no ${path}`)
      const { default: SvelteExample } = await load()
      // React settles alone first: two renders in one document interfere (ids, focus, layout).
      const expected = await reactSettled(createElement(Example))
      const v = document.body.appendChild(document.createElement("div"))
      v.style.pointerEvents = "none"
      const app = mount(SvelteExample, { target: v })
      flushSync()
      // Measured parts (an indicator) settle on a later frame.
      await vi.waitFor(() => expect(canonicalHtml(v)).toBe(expected))
      const { violations } = await axe.run(v, {
        rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
      })
      expect(violations.map((x) => `${x.id}: ${x.nodes[0]?.html}`)).toEqual([])
      await unmount(app)
      v.remove()
    },
  )
})
