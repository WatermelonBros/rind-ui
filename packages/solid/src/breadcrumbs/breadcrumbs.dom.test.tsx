/** @jsxImportSource solid-js */
// Breadcrumbs (stateless): markup parity with React, the driver's contract invariants and axe
// on the Solid parts, and the current crumb's text/link switch.
import * as R from "@rind-ui/react"
import { getBreadcrumbs } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { Fragment as RFragment, createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Breadcrumbs, type BreadcrumbsRootProps } from "../index"

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
const solidTrail = (cfg: Cfg) => (): JSX.Element => (
  <Breadcrumbs.Root {...(rootProps(cfg) as BreadcrumbsRootProps)}>
    <Breadcrumbs.List>
      <For each={cfg.crumbs}>
        {(c, i) => (
          <>
            <Breadcrumbs.Item
              value={c.value}
              {...(c.current === undefined ? {} : { current: c.current })}
            >
              <Breadcrumbs.Link {...(c.href ? { href: c.href } : {})}>{c.label}</Breadcrumbs.Link>
              <Breadcrumbs.Separator>/</Breadcrumbs.Separator>
            </Breadcrumbs.Item>
            {i() === 0 ? (
              <Breadcrumbs.Ellipsis>
                {({ label }) => (
                  <button type="button" aria-label={label}>
                    …
                  </button>
                )}
              </Breadcrumbs.Ellipsis>
            ) : null}
          </>
        )}
      </For>
    </Breadcrumbs.List>
  </Breadcrumbs.Root>
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

describe("Solid Breadcrumbs", () => {
  it("match React", async () => {
    for (const cfg of configs) {
      await clientParity(reactTrail(cfg), solidTrail(cfg))
    }
  })

  it.each(configs.map((cfg, i) => [i, cfg] as const))(
    "config %i holds the contract's invariants and passes axe",
    async (_, cfg) => {
      mount(solidTrail(cfg))
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
    },
  )

  it("the current crumb without href is text, with href a link", () => {
    mount(solidTrail({ crumbs: TRAIL }))
    expect(screen.queryByRole("link", { name: "Link" })).toBeNull()
    expect(screen.getByText("Link").getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("link", { name: "Docs" }).getAttribute("href")).toBe("/docs")
  })
})
