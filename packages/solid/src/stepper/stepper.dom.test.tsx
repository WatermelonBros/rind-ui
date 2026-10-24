/** @jsxImportSource solid-js */
// The Stepper contract model (React's matrix) against the Solid parts, and markup parity.
import { stepperContract, stepperMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, Stepper, type StepperRootProps } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const TITLES = ["Cart", "Shipping", "Payment"]
type P = Record<string, unknown>
const tree = (p: P, extras = false): JSX.Element => (
  <Stepper.Root aria-label="Checkout" count={3} {...(p as Partial<StepperRootProps>)}>
    <Stepper.List>
      <For each={TITLES}>
        {(t, i) => (
          <Stepper.Item index={i()} disabled={extras && i() === 2 ? true : undefined}>
            <Stepper.Trigger>
              {extras ? <Stepper.Indicator>{String(i() + 1)}</Stepper.Indicator> : null}
              <Stepper.Title>{t}</Stepper.Title>
            </Stepper.Trigger>
            {extras ? <Stepper.Description>{`${t} step`}</Stepper.Description> : null}
            {extras ? <Stepper.Separator /> : null}
          </Stepper.Item>
        )}
      </For>
    </Stepper.List>
    <For each={TITLES}>
      {(t, i) => <Stepper.Content index={i()}>{`${t} details`}</Stepper.Content>}
    </For>
    <Stepper.PrevTrigger />
    <Stepper.NextTrigger />
    {extras ? <Stepper.Progress /> : null}
  </Stepper.Root>
)
const reactTree = (p: P, extras = false) =>
  r(
    R.Stepper.Root,
    { "aria-label": "Checkout", count: 3, ...p } as never,
    r(
      R.Stepper.List,
      null,
      TITLES.map((t, i) =>
        r(
          R.Stepper.Item,
          { key: t, index: i, ...(extras && i === 2 ? { disabled: true } : {}) },
          r(
            R.Stepper.Trigger,
            null,
            extras ? r(R.Stepper.Indicator, null, String(i + 1)) : null,
            r(R.Stepper.Title, null, t),
          ),
          extras ? r(R.Stepper.Description, null, `${t} step`) : null,
          extras ? r(R.Stepper.Separator) : null,
        ),
      ),
    ),
    TITLES.map((t, i) => r(R.Stepper.Content, { key: t, index: i }, `${t} details`)),
    r(R.Stepper.PrevTrigger),
    r(R.Stepper.NextTrigger),
    extras ? r(R.Stepper.Progress) : null,
  )

for (const linear of [true, false]) {
  describe(`solid stepper model: ${linear ? "linear" : "non-linear"}`, () => {
    testMachine(stepperContract, {
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () => mount(() => <RindProvider>{tree({ linear })}</RindProvider>),
      target: () => domEnv({ timeout: 200 }),
      anchor: [{ name: "Checkout" }],
      props: {
        id: "oracle",
        count: 3,
        linear,
        messages: stepperMessages,
        disabledSteps: new Set<number>(),
      } as never,
      modalities: ["pointer", "keyboard", "virtual"],
      a11y,
    } as never)
  })
}

describe("Solid Stepper matches React", () => {
  it("linear, non-linear, a step on, indicators, descriptions, a disabled step, progress", async () => {
    for (const [p, extras] of [
      [{}, false],
      [{ linear: false, defaultStep: 1 }, false],
      [{ defaultStep: 1, orientation: "vertical" }, true],
    ] as const) {
      await clientParity(reactTree(p, extras), () => tree(p, extras))
    }
  })
})
