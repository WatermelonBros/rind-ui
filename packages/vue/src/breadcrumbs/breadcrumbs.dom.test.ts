// Breadcrumbs (stateless): markup parity with React, server and client, the driver's
// contract invariants and axe on the Vue parts.
import * as R from "@rind-ui/react"
import { getBreadcrumbs } from "@rind-ui/testing"
import axe from "axe-core"
import { Fragment as RFragment, createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { Fragment, h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Breadcrumbs } from "../index"

interface Crumb {
  readonly value: string
  readonly label: string
  readonly href?: string
  readonly current?: boolean
}
const TRAIL: readonly Crumb[] = [
  { value: "home", label: "Home", href: "/" },
  { value: "docs", label: "Docs", href: "/docs" },
  { value: "link", label: "Link" },
]
const SIX: readonly Crumb[] = ["Home", "Docs", "Guides", "Forms", "Fields", "Page"].map(
  (label, i) => ({
    value: label.toLowerCase(),
    label,
    ...(i < 5 ? { href: `/${i}` } : {}),
  }),
)
interface Cfg {
  readonly crumbs: readonly Crumb[]
  readonly maxItems?: number
  readonly data?: boolean
}
const rootProps = ({ crumbs, maxItems, data }: Cfg) => ({
  ...(maxItems === undefined ? {} : { maxItems }),
  ...(data
    ? {
        items: crumbs.map((c) => ({
          key: c.value,
          textValue: c.label,
          ...(c.href ? { href: c.href } : {}),
          ...(c.current === undefined ? {} : { current: c.current }),
        })),
      }
    : {}),
})
const vueTrail = (cfg: Cfg) => () =>
  h(Breadcrumbs.Root, rootProps(cfg), () =>
    h(Breadcrumbs.List, null, () =>
      cfg.crumbs.map((c, i) =>
        h(Fragment, { key: c.value }, [
          h(
            Breadcrumbs.Item,
            { value: c.value, ...(c.current === undefined ? {} : { current: c.current }) },
            () => [
              h(Breadcrumbs.Link, c.href ? { href: c.href } : {}, () => c.label),
              h(Breadcrumbs.Separator, null, () => "/"),
            ],
          ),
          i === 0
            ? h(Breadcrumbs.Ellipsis, null, {
                default: ({ label }: { label: string }) =>
                  h("button", { type: "button", "aria-label": label }, "…"),
              })
            : null,
        ]),
      ),
    ),
  )
const reactTrail = (cfg: Cfg) =>
  r(
    R.Breadcrumbs.Root,
    rootProps(cfg),
    r(
      R.Breadcrumbs.List,
      null,
      cfg.crumbs.map((c, i) =>
        r(
          RFragment,
          { key: c.value },
          r(
            R.Breadcrumbs.Item,
            { value: c.value, ...(c.current === undefined ? {} : { current: c.current }) },
            r(R.Breadcrumbs.Link, c.href ? { href: c.href } : {}, c.label),
            r(R.Breadcrumbs.Separator, null, "/"),
          ),
          i === 0
            ? r(R.Breadcrumbs.Ellipsis, null, (({ label }: { label: string }) =>
                r("button", { type: "button", "aria-label": label }, "…")) as never)
            : null,
        ),
      ),
    ),
  )
const configs: Cfg[] = [
  { crumbs: TRAIL },
  { crumbs: SIX, maxItems: 4 },
  { crumbs: SIX, maxItems: 4, data: true },
  { crumbs: TRAIL.map((c, i) => (i === 2 ? { ...c, current: false } : c)) },
  { crumbs: TRAIL.map((c, i) => (i === 1 ? { ...c, current: true } : c)) },
]

describe("Vue Breadcrumbs", () => {
  it("match React", async () => {
    for (const cfg of configs) {
      await serverParity(reactTrail(cfg), vueTrail(cfg))
      await clientParity(reactTrail(cfg), vueTrail(cfg))
    }
  })

  it.each(configs.map((cfg, i) => [i, cfg] as const))(
    "config %i holds the contract's invariants and passes axe",
    async (_, cfg) => {
      {
        mount(vueTrail(cfg))
        const d = getBreadcrumbs(document.body, { name: "Breadcrumbs" })
        const out: string[] = []
        for (const inv of d.contract.invariants ?? []) {
          const msg = await inv.check({
            env: d.env as never,
            state: "static",
            modality: "pointer",
            props: {},
            values: {},
          })
          if (msg) out.push(`${inv.name}: ${msg}`)
        }
        expect(out).toEqual([])
        const a = await axe.run(document.body, { rules: { region: { enabled: false } } })
        expect(a.violations.map((v) => v.id)).toEqual([])
      }
    },
  )
})
