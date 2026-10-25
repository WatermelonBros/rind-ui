/** @jsxImportSource solid-js */
// Timeline (stateless): markup parity with React, the driver's contract invariants and axe on
// the Solid parts.
import * as R from "@rind-ui/react"
import { getTimeline } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Timeline, type TimelineRootProps } from "../index"

const EVENTS = ["Ordered", "Shipped", "Delivered"]
type Cfg = Record<string, unknown> & { readonly pendingLast?: boolean }
const order = ({ pendingLast, ...root }: Cfg) =>
  function Order(): JSX.Element {
    return (
      <Timeline.Root aria-label="Order" {...(root as Partial<TimelineRootProps>)}>
        <For each={EVENTS}>
          {(title, index) => (
            <Timeline.Item
              index={index()}
              status={pendingLast && index() === 2 ? "pending" : undefined}
            >
              <Timeline.Indicator />
              <Timeline.Connector />
              <Timeline.Content>
                <Timeline.Title>{title}</Timeline.Title>
                <Timeline.Time dateTime="2026-10-20T09:00:00.000Z">Oct 20</Timeline.Time>
              </Timeline.Content>
              <Timeline.Opposite>Note</Timeline.Opposite>
              <Timeline.Description>{`${title} details`}</Timeline.Description>
            </Timeline.Item>
          )}
        </For>
      </Timeline.Root>
    )
  }
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

describe("Solid Timeline", () => {
  it("matches React", async () => {
    for (const cfg of configs) {
      const Order = order(cfg)
      await clientParity(reactOrder(cfg), () => <Order />)
    }
  })

  it.each(configs.map((cfg, i) => [i, cfg] as const))(
    "config %i holds the contract's invariants and passes axe",
    async (_, cfg) => {
      const Order = order(cfg)
      mount(() => <Order />)
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
