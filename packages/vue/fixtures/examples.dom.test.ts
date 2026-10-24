// The copyable Vue examples (packages/vue/examples/<slug>/<Name>.vue, shown on the docs
// site's "Get code" panel): each renders the same markup as the site's React example of the
// same name (apps/site/examples/<slug>.tsx), and passes axe.
import { canonicalHtml } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement, type FunctionComponent } from "react"
import { describe, expect, it, vi } from "vitest"
import { type Component, createApp, nextTick } from "vue"
import { reactSettled } from "./parity"

const vue = import.meta.glob<{ default: Component }>("../examples/*/*.vue")
const react = import.meta.glob<Record<string, unknown>>("../../../apps/site/examples/*.tsx")
// Vite's `import.meta.glob` (the package does not depend on Vite's client types).
declare global {
  interface ImportMeta {
    glob<T>(pattern: string): Record<string, () => Promise<T>>
  }
}

const cases = Object.keys(vue).map((path) => {
  const [, slug = "", name = ""] = /examples\/([^/]+)\/([^/]+)\.vue$/.exec(path) ?? []
  return { path, slug, name }
})

describe("Vue examples", () => {
  it("exist", () => expect(cases.length).toBeGreaterThan(0))

  it.each(cases)(
    "$slug/$name matches the React example and passes axe",
    async ({ path, slug, name }) => {
      const source = react[`../../../apps/site/examples/${slug}.tsx`]
      if (!source) throw new Error(`no React examples for ${slug}`)
      const Example = (await source())[name] as FunctionComponent | undefined
      if (!Example) throw new Error(`apps/site/examples/${slug}.tsx has no export ${name}`)
      const load = vue[path]
      if (!load) throw new Error(`no ${path}`)
      const { default: VueExample } = await load()
      // React settles alone first: two renders in one document interfere (ids, focus, layout).
      const expected = await reactSettled(createElement(Example))
      const v = document.body.appendChild(document.createElement("div"))
      v.style.pointerEvents = "none"
      const app = createApp(VueExample)
      app.mount(v)
      await nextTick()
      // Measured parts (an indicator) settle on a later frame.
      await vi.waitFor(() => expect(canonicalHtml(v)).toBe(expected))
      const { violations } = await axe.run(v, {
        rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
      })
      expect(violations.map((x) => `${x.id}: ${x.nodes[0]?.html}`)).toEqual([])
      app.unmount()
      v.remove()
    },
  )
})
