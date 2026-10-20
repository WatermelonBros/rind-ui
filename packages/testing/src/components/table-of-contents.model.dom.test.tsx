// Model-based tests (add-table-of-contents 3.1): following a link by every modality from each
// state; the invariant (at most one current location) and axe after every step.
import type { TableOfContentsItem } from "@rind-ui/core"
import { tableOfContentsContract } from "@rind-ui/core"
import { RindProvider, TableOfContents } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { domEnv, testMachine, virtualClock } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const ITEMS: TableOfContentsItem[] = [
  { id: "intro", label: "Intro", depth: 0 },
  { id: "install", label: "Install", depth: 0 },
  { id: "faq", label: "FAQ", depth: 0 },
]

describe("table of contents model", () => {
  const clock = virtualClock()
  testMachine(tableOfContentsContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () =>
      render(
        <RindProvider environment={{ scheduler: clock.scheduler }}>
          <TableOfContents.Root items={ITEMS}>
            <TableOfContents.List>
              {ITEMS.map((item) => (
                <TableOfContents.Item key={item.id} item={item}>
                  <TableOfContents.Link />
                </TableOfContents.Item>
              ))}
            </TableOfContents.List>
          </TableOfContents.Root>
          <main>
            {ITEMS.map((item) => (
              <section key={item.id} style={{ blockSize: 400 }}>
                <h2 id={item.id}>{item.label}</h2>
              </section>
            ))}
          </main>
        </RindProvider>,
      ),
    target: () => domEnv({ timeout: 200, advanceClock: (ms) => clock.advance(ms) }),
    anchor: [{ name: "On this page" }],
    props: { id: "oracle" } as never,
    modalities: ["pointer", "keyboard", "virtual"],
    a11y,
  } as never)
})
