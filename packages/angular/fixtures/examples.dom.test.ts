// The copyable Angular examples (packages/angular/examples/<slug>/<Name>.ts, shown on the docs
// site's "Get code" panel): each renders the same markup as the site's React example of the
// same name (apps/site/examples/<slug>.tsx), and passes axe.
import { APP_ID, type Type } from "@angular/core"
import { canonicalHtml } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement, type FunctionComponent } from "react"
import { describe, expect, it, vi } from "vitest"
import { mount } from "./mount"
import { reactSettled, withoutAngular } from "./parity"

const angular = import.meta.glob<Record<string, unknown>>("../examples/*/*.ts")
const react = import.meta.glob<Record<string, unknown>>("../../../apps/site/examples/*.tsx")
// Vite's `import.meta.glob` (the package does not depend on Vite's client types).
declare global {
  interface ImportMeta {
    glob<T>(pattern: string): Record<string, () => Promise<T>>
  }
}

const cases = Object.keys(angular).map((path) => {
  const [, slug = "", name = ""] = /examples\/([^/]+)\/([^/]+)\.ts$/.exec(path) ?? []
  return { path, slug, name }
})

describe("Angular examples", () => {
  it("exist", () => expect(cases.length).toBeGreaterThan(0))

  it.each(cases)(
    "$slug/$name matches the React example and passes axe",
    async ({ path, slug, name }) => {
      const source = react[`../../../apps/site/examples/${slug}.tsx`]
      if (!source) throw new Error(`no React examples for ${slug}`)
      const Example = (await source())[name] as FunctionComponent | undefined
      if (!Example) throw new Error(`apps/site/examples/${slug}.tsx has no export ${name}`)
      const load = angular[path]
      if (!load) throw new Error(`no ${path}`)
      // Each example file exports its component under the file's name.
      const AngularExample = (await load())[name] as Type<unknown> | undefined
      if (!AngularExample) throw new Error(`${path} has no export ${name}`)
      // React settles alone first: two renders in one document interfere (ids, focus, layout).
      const expected = await reactSettled(createElement(Example))
      // An app id canonicalHtml knows as generated (an item keyed by its generated id).
      const { host } = await mount(AngularExample, {}, [{ provide: APP_ID, useValue: "parity0" }])
      host.style.pointerEvents = "none"
      // Measured parts (an indicator) settle on a later frame.
      await vi.waitFor(() => expect(canonicalHtml(withoutAngular(host))).toBe(expected))
      const { violations } = await axe.run(host, {
        rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
      })
      expect(violations.map((x) => `${x.id}: ${x.nodes[0]?.html}`)).toEqual([])
    },
  )
})
