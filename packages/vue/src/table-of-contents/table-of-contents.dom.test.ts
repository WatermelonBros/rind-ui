// The Table of Contents contract model (React's) against the Vue parts, and markup parity.
import { type TableOfContentsItem, tableOfContentsContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { RindProvider, TableOfContents } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const ITEMS: TableOfContentsItem[] = [
  { id: "intro", label: "Intro", depth: 0 },
  { id: "install", label: "Install", depth: 0 },
  { id: "faq", label: "FAQ", depth: 1 },
]
const toc = (p: Record<string, unknown> = {}, extras = false) =>
  h(TableOfContents.Root, { items: ITEMS, ...p }, () => [
    ...(extras ? [h(TableOfContents.Title, null, () => "Contents")] : []),
    h(TableOfContents.List, null, () => [
      ...ITEMS.map((item) =>
        h(TableOfContents.Item, { key: item.id, item }, () => h(TableOfContents.Link)),
      ),
      ...(extras ? [h(TableOfContents.Indicator)] : []),
    ]),
  ])
const reactToc = (p: Record<string, unknown> = {}, extras = false) =>
  r(
    R.TableOfContents.Root,
    { items: ITEMS, ...p } as never,
    extras ? r(R.TableOfContents.Title, null, "Contents") : null,
    r(
      R.TableOfContents.List,
      null,
      ITEMS.map((item) =>
        r(R.TableOfContents.Item, { key: item.id, item }, r(R.TableOfContents.Link)),
      ),
      extras ? r(R.TableOfContents.Indicator) : null,
    ),
  )

describe("vue table of contents model", () => {
  const clock = virtualClock()
  testMachine(tableOfContentsContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () =>
      mount(() =>
        h(RindProvider, { environment: { scheduler: clock.scheduler } }, () => [
          toc(),
          h(
            "main",
            null,
            ITEMS.map((item) =>
              h("section", { key: item.id, style: { blockSize: "400px" } }, [
                h("h2", { id: item.id }, item.label),
              ]),
            ),
          ),
        ]),
      ),
    target: () => domEnv({ timeout: 200, advanceClock: (ms) => clock.advance(ms) }),
    anchor: [{ name: "On this page" }],
    props: { id: "oracle" } as never,
    modalities: ["pointer", "keyboard", "virtual"],
    a11y,
  } as never)
})

describe("Vue Table of Contents matches React", () => {
  it("plain, titled with an indicator, a current section", async () => {
    for (const [p, extras] of [
      [{}, false],
      [{}, true],
      [{ defaultValue: "install" }, true],
    ] as const) {
      await serverParity(reactToc(p, extras), () => toc(p, extras))
      await clientParity(reactToc(p, extras), () => toc(p, extras))
    }
  })
})
