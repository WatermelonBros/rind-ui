// Collapsible and Accordion: React's contract models against the Svelte parts, and DOM parity.
import {
  accordionArgs,
  accordionContract,
  type ClosedContent,
  collapsibleContract,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { accordionStepInvariants, currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Details from "../../fixtures/collapsible/details.svelte"
import Faq from "../../fixtures/collapsible/faq.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const collapsibleBase = {
  open: undefined,
  defaultOpen: undefined,
  onOpenChange: undefined,
  disabled: undefined,
  focusOutOfContent: undefined,
}
for (const closedContent of ["until-found", "hidden", "unmount"] as readonly ClosedContent[]) {
  for (const disabled of [false, true]) {
    for (const defaultOpen of [false, true]) {
      describe(`svelte collapsible model: ${closedContent}, disabled ${disabled}, open ${defaultOpen}`, () => {
        testMachine(collapsibleContract, {
          test: it,
          setup: () => mount(Details, { root: { closedContent, disabled, defaultOpen } } as never),
          target: () => screen,
          anchor: [{ name: "Details" }] as never,
          props: { ...collapsibleBase, disabled, defaultOpen } as never,
          a11y,
        })
      })
    }
  }
}
describe("svelte collapsible model: controlled ($sync:open)", () => {
  testMachine(collapsibleContract, {
    test: it,
    setup: () => mount(Details, { controlled: true, open: false } as never),
    rerender: (next, rendered) =>
      rendered.rerender({ open: (next as { open: boolean }).open } as never),
    target: () => screen,
    anchor: [{ name: "Details" }] as never,
    props: { ...collapsibleBase, open: false } as never,
    a11y,
    modalities: ["pointer"],
  })
})

const ITEMS = [
  { item: "a", label: "Shipping" },
  { item: "b", label: "Returns" },
  { item: "c", label: "Payment" },
] as const
const classes = { first: ITEMS[0], another: ITEMS[1], disabled: ITEMS[2] } as const
const accordionBase = {
  value: undefined,
  defaultValue: undefined,
  onValueChange: undefined,
  disabled: undefined,
  triggerOrder: undefined,
  focusTrigger: undefined,
}
let tracked: readonly string[] = []
const steps = accordionStepInvariants({
  value: () => tracked,
  labels: Object.fromEntries(ITEMS.map(({ item, label }) => [item, label])),
})
for (const multiple of [false, true]) {
  for (const collapsible of multiple ? [true] : [true, false]) {
    for (const keyboardNavigation of [false, true]) {
      for (const [name, cls] of Object.entries(classes)) {
        const cfg = { multiple, collapsible, keyboardNavigation }
        describe(`svelte accordion model: ${JSON.stringify(cfg)}, ${name} item`, () => {
          testMachine(accordionContract, {
            test: it,
            setup: () => {
              accordionArgs.current = cls
              tracked = []
              steps.reset()
              return mount(Faq, {
                root: { ...cfg, dir: currentRun()?.direction ?? "ltr" },
                disabledItem: name === "disabled",
                onValue: (v: readonly string[]) => (tracked = v),
              } as never)
            },
            target: () => screen,
            anchor: [{ item: "Shipping" }] as never,
            props: { ...accordionBase, ...cfg } as never,
            invariants: steps.invariants,
            a11y,
          })
        })
      }
    }
  }
}

const reactDetails = (p: P) =>
  r(
    R.Collapsible.Root,
    p,
    r(R.Collapsible.Trigger, null, "Details ", r(R.Collapsible.Indicator)),
    r(R.Collapsible.Content, null, r("a", { href: "#more" }, "More")),
  )
const reactFaq = (cfg: P) =>
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
describe("Svelte Collapsible and Accordion match React", () => {
  it("modes, open, disabled, multiple, heading level", async () => {
    for (const p of [
      {},
      { defaultOpen: true },
      { closedContent: "hidden" },
      { closedContent: "unmount" },
      { disabled: true, focusableWhenDisabled: true },
    ]) {
      await clientParity(reactDetails(p), Details, { root: p, provider: false } as never)
    }
    for (const cfg of [
      {},
      { multiple: true, defaultValue: ["a", "c"] },
      { defaultValue: ["b"], headingLevel: 2 },
      { disabled: true },
    ]) {
      await clientParity(reactFaq(cfg), Faq, { root: cfg, provider: false } as never)
    }
  })
})
