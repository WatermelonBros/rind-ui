// The copyable Vue examples (packages/vue/examples/<slug>/<Name>.vue, shown on the docs
// site's "Get code" panel): each renders the same markup as the site's React example of the
// same name (apps/site/examples/<slug>.tsx), and passes axe.
import { allowRindWarning, canonicalHtml } from "@rind-ui/testing"
import axe from "axe-core"
import { act, createElement, type FunctionComponent } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { type Component, createApp, nextTick } from "vue"

const vue = import.meta.glob<{ default: Component }>("../examples/*/*.vue")
const react = import.meta.glob<Record<string, unknown>>("../../../apps/site/examples/*.tsx")
// Vite's `import.meta.glob` (the package does not depend on Vite's client types).
declare global {
  interface ImportMeta {
    glob<T>(pattern: string): Record<string, () => Promise<T>>
  }
}
const reactAct = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

const cases = Object.keys(vue).map((path) => {
  const [, slug = "", name = ""] = /examples\/([^/]+)\/([^/]+)\.vue$/.exec(path) ?? []
  return { path, slug, name }
})

describe("Vue examples", () => {
  it("exist", () => expect(cases.length).toBeGreaterThan(0))

  it.each(cases)(
    "$slug/$name matches the React example and passes axe",
    async ({ path, slug, name }) => {
      // Both examples are mounted together: two landmarks of one name (a pagination).
      allowRindWarning(/two \w+ landmarks are named/)
      const source = react[`../../../apps/site/examples/${slug}.tsx`]
      if (!source) throw new Error(`no React examples for ${slug}`)
      const Example = (await source())[name] as FunctionComponent | undefined
      if (!Example) throw new Error(`apps/site/examples/${slug}.tsx has no export ${name}`)
      const load = vue[path]
      if (!load) throw new Error(`no ${path}`)
      const { default: VueExample } = await load()
      reactAct.IS_REACT_ACT_ENVIRONMENT = true
      const r = document.body.appendChild(document.createElement("div"))
      const root = createRoot(r)
      await act(async () => root.render(createElement(Example)))
      const v = document.body.appendChild(document.createElement("div"))
      const app = createApp(VueExample)
      app.mount(v)
      await nextTick()
      expect(canonicalHtml(v)).toBe(canonicalHtml(r))
      await act(async () => root.unmount())
      r.remove()
      const { violations } = await axe.run(v, {
        rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
      })
      expect(violations.map((x) => `${x.id}: ${x.nodes[0]?.html}`)).toEqual([])
      app.unmount()
      v.remove()
    },
  )
})
