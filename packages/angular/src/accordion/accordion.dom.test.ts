// The Accordion contract model (React's matrix) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import { accordionArgs, accordionContract, type HeadingLevel, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { accordionStepInvariants, currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Accordion } from "./accordion"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const ITEMS = [
  { item: "a", label: "Shipping" },
  { item: "b", label: "Returns" },
  { item: "c", label: "Payment" },
] as const
const classes = { first: ITEMS[0], another: ITEMS[1], disabled: ITEMS[2] } as const
type Cfg = {
  multiple?: boolean
  collapsible?: boolean
  keyboardNavigation?: boolean
  defaultValue?: readonly string[]
  headingLevel?: HeadingLevel
  disabled?: boolean
}
const base = {
  value: undefined,
  defaultValue: undefined,
  onValueChange: undefined,
  disabled: undefined,
  triggerOrder: undefined,
  focusTrigger: undefined,
}
let tracked: readonly string[] = []
const labels = Object.fromEntries(ITEMS.map(({ item, label }) => [item, label]))
const steps = accordionStepInvariants({ value: () => tracked, labels })

/** The configuration the next fixture renders. */
let current: { cfg: Cfg; disabledItem: boolean } = { cfg: {}, disabledItem: false }

@Component({
  selector: "rind-f",
  imports: [RindProvider, Accordion],
  template: `<ng-container rindProvider [environment]="env">
    <div
      rindAccordionRoot
      [multiple]="cfg.multiple ?? false"
      [collapsible]="cfg.collapsible ?? true"
      [keyboardNavigation]="cfg.keyboardNavigation ?? false"
      [defaultValue]="cfg.defaultValue"
      [headingLevel]="cfg.headingLevel"
      [disabled]="cfg.disabled ?? false"
      [dir]="dir"
      (valueChange)="track($event)"
    >
      @for (i of items; track i.item) {
        <div rindAccordionItem [value]="i.item" [disabled]="disabledItem && i.item === 'c'">
          @if (cfg.headingLevel === 2) {
            <h2 rindAccordionHeader>
              <button rindAccordionTrigger>{{ i.label }} <span rindAccordionIndicator></span></button>
            </h2>
          } @else {
            <h3 rindAccordionHeader>
              <button rindAccordionTrigger>{{ i.label }} <span rindAccordionIndicator></span></button>
            </h3>
          }
          <div rindAccordionContent><p>{{ i.label }} details</p></div>
        </div>
      }
    </div>
  </ng-container>`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly cfg = current.cfg
  readonly disabledItem = current.disabledItem
  readonly items = ITEMS
  track(v: readonly string[]) {
    tracked = v
  }
}
const reactTree = (cfg: Cfg) =>
  r(
    R.Accordion.Root,
    cfg as never,
    ITEMS.map(({ item, label }) =>
      r(
        R.Accordion.Item,
        { key: item, value: item },
        r(
          R.Accordion.Header,
          null,
          r(R.Accordion.Trigger, null, `${label} `, r(R.Accordion.Indicator)),
        ),
        r(R.Accordion.Content, null, r("p", null, `${label} details`)),
      ),
    ),
  )

for (const multiple of [false, true]) {
  for (const collapsible of multiple ? [true] : [true, false]) {
    for (const keyboardNavigation of [false, true]) {
      for (const [name, cls] of Object.entries(classes)) {
        const cfg = { multiple, collapsible, keyboardNavigation }
        describe(`angular accordion model: ${JSON.stringify(cfg)}, ${name} item`, () => {
          testMachine(accordionContract, {
            test: it,
            setup: () => {
              accordionArgs.current = cls
              tracked = []
              steps.reset()
              current = { cfg, disabledItem: name === "disabled" }
              return mount(Tree)
            },
            target: () => screen,
            anchor: [{ item: "Shipping" }] as never,
            props: { ...base, ...cfg } as never,
            invariants: steps.invariants,
            a11y,
          })
        })
      }
    }
  }
}

describe("Angular Accordion matches React", () => {
  it("single, multiple, an open item, heading level", async () => {
    for (const cfg of [
      {},
      { multiple: true, defaultValue: ["a", "c"] },
      { defaultValue: ["b"], headingLevel: 2 },
      { disabled: true },
    ] as Cfg[]) {
      current = { cfg, disabledItem: false }
      await both(reactTree(cfg), Tree)
    }
  })
})
