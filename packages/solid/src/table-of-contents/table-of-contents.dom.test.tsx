/** @jsxImportSource solid-js */
// The Table of Contents contract model (React's) against the Solid parts, and markup parity.
import { type TableOfContentsItem, tableOfContentsContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, TableOfContents, type TableOfContentsRootProps } from "../index"

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
const toc = (p: Record<string, unknown> = {}, extras = false): JSX.Element => (
  <TableOfContents.Root items={ITEMS} {...(p as Partial<TableOfContentsRootProps>)}>
    {extras ? <TableOfContents.Title>Contents</TableOfContents.Title> : null}
    <TableOfContents.List>
      <For each={ITEMS}>
        {(item) => (
          <TableOfContents.Item item={item}>
            <TableOfContents.Link />
          </TableOfContents.Item>
        )}
      </For>
      {extras ? <TableOfContents.Indicator /> : null}
    </TableOfContents.List>
  </TableOfContents.Root>
)
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

describe("solid table of contents model", () => {
  const clock = virtualClock()
  testMachine(tableOfContentsContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () =>
      mount(() => (
        <RindProvider environment={{ scheduler: clock.scheduler }}>
          {toc()}
          <main>
            <For each={ITEMS}>
              {(item) => (
                <section style={{ "block-size": "400px" }}>
                  <h2 id={item.id}>{item.label}</h2>
                </section>
              )}
            </For>
          </main>
        </RindProvider>
      )),
    target: () => domEnv({ timeout: 200, advanceClock: (ms) => clock.advance(ms) }),
    anchor: [{ name: "On this page" }],
    props: { id: "oracle" } as never,
    modalities: ["pointer", "keyboard", "virtual"],
    a11y,
  } as never)
})

describe("Solid Table of Contents matches React", () => {
  it("plain, titled with an indicator, a current section", async () => {
    for (const [p, extras] of [
      [{}, false],
      [{}, true],
      [{ defaultValue: "install" }, true],
    ] as const) {
      await clientParity(reactToc(p, extras), () => toc(p, extras))
    }
  })
})
