// The Table of Contents contract model (React's) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import { type TableOfContentsItem, tableOfContentsContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { TableOfContents } from "./table-of-contents"

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
const clock = virtualClock()
/** The configuration the next fixture renders. */
let current: { defaultValue?: string; extras: boolean; page: boolean } = {
  extras: false,
  page: false,
}

@Component({
  selector: "rind-f",
  imports: [RindProvider, TableOfContents],
  template: `<ng-container rindProvider [environment]="env">
    <nav rindTableOfContentsRoot [items]="items" [defaultValue]="cfg.defaultValue">
      @if (cfg.extras) {
        <h2 rindTableOfContentsTitle>Contents</h2>
      }
      <ol rindTableOfContentsList>
        @for (item of items; track item.id) {
          <li rindTableOfContentsItem [item]="item"><a rindTableOfContentsLink></a></li>
        }
        @if (cfg.extras) {
          <span rindTableOfContentsIndicator></span>
        }
      </ol>
    </nav>
    @if (cfg.page) {
      <main>
        @for (item of items; track item.id) {
          <section style="block-size: 400px"><h2 [id]="item.id">{{ item.label }}</h2></section>
        }
      </main>
    }
  </ng-container>`,
})
class Toc {
  readonly cfg = current
  readonly items = ITEMS
  readonly env = current.page ? { scheduler: clock.scheduler } : {}
}
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

describe("angular table of contents model", () => {
  testMachine(tableOfContentsContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () => {
      current = { extras: false, page: true }
      return mount(Toc)
    },
    target: () => domEnv({ timeout: 200, advanceClock: (ms) => clock.advance(ms) }),
    anchor: [{ name: "On this page" }],
    props: { id: "oracle" } as never,
    modalities: ["pointer", "keyboard", "virtual"],
    a11y,
  } as never)
})

describe("Angular Table of Contents matches React", () => {
  it("plain, titled with an indicator, a current section", async () => {
    for (const [p, extras] of [
      [{}, false],
      [{}, true],
      [{ defaultValue: "install" }, true],
    ] as const) {
      current = { ...p, extras, page: false }
      await both(reactToc(p, extras), Toc)
    }
  })
})
