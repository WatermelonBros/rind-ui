// The Collapsible contract model (React's matrix) against the Angular parts, and markup parity.
import { Component, input } from "@angular/core"
import { type ClosedContent, collapsibleContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Collapsible } from "./collapsible"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const base = {
  open: undefined,
  defaultOpen: undefined,
  onOpenChange: undefined,
  disabled: undefined,
  focusOutOfContent: undefined,
}
const anchor = [{ name: "Details" }] as never
type P = {
  closedContent?: ClosedContent
  disabled?: boolean
  defaultOpen?: boolean
  focusableWhenDisabled?: boolean
}
/** The inputs the next fixture starts with. */
let current: P = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, Collapsible],
  template: `<ng-container rindProvider [environment]="env">
    <div
      rindCollapsibleRoot
      [closedContent]="p.closedContent ?? 'until-found'"
      [disabled]="p.disabled ?? false"
      [defaultOpen]="p.defaultOpen"
      [focusableWhenDisabled]="p.focusableWhenDisabled ?? false"
      [open]="open()"
    >
      <button rindCollapsibleTrigger>Details <span rindCollapsibleIndicator></span></button>
      <div rindCollapsibleContent><a href="#more">More</a></div>
    </div>
  </ng-container>`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly p = current
  readonly open = input<boolean | undefined>(undefined)
}
const reactTree = (p: P) =>
  r(
    R.Collapsible.Root,
    p,
    r(R.Collapsible.Trigger, null, "Details ", r(R.Collapsible.Indicator)),
    r(R.Collapsible.Content, null, r("a", { href: "#more" }, "More")),
  )

for (const closedContent of ["until-found", "hidden", "unmount"] as readonly ClosedContent[]) {
  for (const disabled of [false, true]) {
    for (const defaultOpen of [false, true]) {
      describe(`angular collapsible model: ${closedContent}, disabled ${disabled}, open ${defaultOpen}`, () => {
        testMachine(collapsibleContract, {
          test: it,
          setup: () => {
            current = { closedContent, disabled, defaultOpen }
            return mount(Tree)
          },
          target: () => screen,
          anchor,
          props: { ...base, disabled, defaultOpen } as never,
          a11y,
        })
      })
    }
  }
}

describe("angular collapsible model: controlled ([open])", () => {
  testMachine(collapsibleContract, {
    test: it,
    setup: () => {
      current = {}
      return mount(Tree, { open: false })
    },
    rerender: (next, rendered) => rendered.rerender({ open: (next as { open: boolean }).open }),
    target: () => screen,
    anchor,
    props: { ...base, open: false } as never,
    a11y,
    modalities: ["pointer"],
  })
})

describe("Angular Collapsible matches React", () => {
  it("closed modes, open, disabled", async () => {
    for (const p of [
      {},
      { defaultOpen: true },
      { closedContent: "hidden" },
      { closedContent: "unmount" },
      { disabled: true, focusableWhenDisabled: true },
    ] as P[]) {
      current = p
      await both(reactTree(p), Tree)
    }
  })
})
