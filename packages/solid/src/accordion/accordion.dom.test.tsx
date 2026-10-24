/** @jsxImportSource solid-js */
// The Accordion contract model (React's matrix) against the Solid parts, and markup parity.
import { accordionArgs, accordionContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { accordionStepInvariants, currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Accordion, type AccordionRootProps, RindProvider } from "../index"

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
type Cfg = Record<string, unknown>
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

const tree = (cfg: Cfg, disabledItem = false): JSX.Element => (
  <Accordion.Root {...(cfg as AccordionRootProps)} onValueChange={(v) => (tracked = v)}>
    <For each={ITEMS}>
      {({ item, label }) => (
        <Accordion.Item value={item} disabled={disabledItem && item === "c"}>
          <Accordion.Header>
            <Accordion.Trigger>
              {label} <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <p>{label} details</p>
          </Accordion.Content>
        </Accordion.Item>
      )}
    </For>
  </Accordion.Root>
)
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
        describe(`solid accordion model: ${JSON.stringify(cfg)}, ${name} item`, () => {
          testMachine(accordionContract, {
            test: it,
            setup: () => {
              accordionArgs.current = cls
              tracked = []
              steps.reset()
              return mount(() => (
                <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
                  {tree({ ...cfg, dir: currentRun()?.direction ?? "ltr" }, name === "disabled")}
                </RindProvider>
              ))
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

describe("Solid Accordion matches React", () => {
  it("single, multiple, an open item, heading level", async () => {
    for (const cfg of [
      {},
      { multiple: true, defaultValue: ["a", "c"] },
      { defaultValue: ["b"], headingLevel: 2 },
      { disabled: true },
    ]) {
      await clientParity(reactTree(cfg), () => tree(cfg))
    }
  })
})
