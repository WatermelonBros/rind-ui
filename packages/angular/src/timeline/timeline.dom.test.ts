// Timeline (stateless): markup parity with React, server and client, the driver's contract
// invariants and axe on the Angular parts.
import { Component } from "@angular/core"
import type { TimelineAlign, TimelineOrientation } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getTimeline } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Timeline } from "./timeline"

const EVENTS = ["Ordered", "Shipped", "Delivered"]
interface Cfg {
  readonly current?: number
  readonly align?: TimelineAlign
  readonly orientation?: TimelineOrientation
  readonly pendingLast?: boolean
}
/** The configuration the next fixture renders. */
let current: Cfg = {}

@Component({
  selector: "rind-f",
  imports: [Timeline],
  template: `<ol
    rindTimelineRoot
    aria-label="Order"
    [current]="cfg.current"
    [align]="cfg.align ?? 'start'"
    [orientation]="cfg.orientation ?? 'vertical'"
  >
    @for (title of events; track title; let index = $index) {
      <li rindTimelineItem [index]="index" [status]="cfg.pendingLast && index === 2 ? 'pending' : undefined">
        <div rindTimelineIndicator></div>
        <div rindTimelineConnector></div>
        <div rindTimelineContent>
          <div rindTimelineTitle>{{ title }}</div>
          <time rindTimelineTime datetime="2026-10-20T09:00:00.000Z">Oct 20</time>
        </div>
        <div rindTimelineOpposite>Note</div>
        <div rindTimelineDescription>{{ title }} details</div>
      </li>
    }
  </ol>`,
})
class Order {
  readonly cfg = current
  readonly events = EVENTS
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

describe("Angular Timeline", () => {
  it("matches React", async () => {
    for (const cfg of configs) {
      current = cfg
      await both(reactOrder(cfg), Order)
    }
  })

  it.each(configs.map((cfg, i) => [i, cfg] as const))(
    "config %i holds the contract's invariants and passes axe",
    async (_, cfg) => {
      current = cfg
      await mount(Order)
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
