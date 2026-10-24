// Timeline (stateless): DOM parity with React, the driver's contract
// invariants and axe on the Svelte parts.
import * as R from "@rind-ui/react"
import { getTimeline } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Order from "../../fixtures/timeline/order.svelte"

const EVENTS = ["Ordered", "Shipped", "Delivered"]
type Cfg = Record<string, unknown> & { readonly pendingLast?: boolean }
const svelteProps = ({ pendingLast, ...root }: Cfg) =>
  ({ root, pendingLast: pendingLast === true }) as never
const reactOrder = ({ pendingLast, ...root }: Cfg) =>
  r(
    R.Timeline.Root,
    { "aria-label": "Order", ...root } as never,
    EVENTS.map((title, index) =>
      r(
        R.Timeline.Item,
        {
          key: title,
          index,
          ...(pendingLast && index === 2 ? { status: "pending" as const } : {}),
        },
        r(R.Timeline.Indicator),
        r(R.Timeline.Connector),
        r(
          R.Timeline.Content,
          null,
          r(R.Timeline.Title, null, title),
          r(R.Timeline.Time, { dateTime: "2026-10-20T09:00:00.000Z" }, "Oct 20"),
        ),
        r(R.Timeline.Opposite, null, "Note"),
        r(R.Timeline.Description, null, `${title} details`),
      ),
    ),
  )
const configs: Cfg[] = [
  {},
  { current: 1 },
  { current: 1, pendingLast: true },
  { align: "alternate", orientation: "horizontal" },
]

describe("Svelte Timeline", () => {
  it("matches React", async () => {
    for (const cfg of configs) {
      await clientParity(reactOrder(cfg), Order, svelteProps(cfg))
    }
  })

  it.each(configs.map((cfg, i) => [i, cfg] as const))(
    "config %i holds the contract's invariants and passes axe",
    async (_, cfg) => {
      mount(Order, svelteProps(cfg))
      const d = getTimeline(document.body, { name: "Order" })
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
})
