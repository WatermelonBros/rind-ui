// The Stepper contract model (React's matrix) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import { stepperContract, stepperMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Stepper } from "./stepper"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const TITLES = ["Cart", "Shipping", "Payment"]
interface P {
  readonly linear?: boolean
  readonly defaultStep?: number
  readonly orientation?: "horizontal" | "vertical"
}
/** The configuration the next fixture renders. */
let current: { p: P; extras: boolean } = { p: {}, extras: false }

const TRIGGER_CONTENT = `@if (extras) {
              <span rindStepperIndicator>{{ i + 1 }}</span>
            }
            <span rindStepperTitle>{{ t }}</span>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Stepper],
  template: `<ng-container rindProvider>
    <div
      rindStepperRoot
      aria-label="Checkout"
      [count]="3"
      [linear]="p.linear"
      [defaultStep]="p.defaultStep"
      [orientation]="p.orientation ?? 'horizontal'"
    >
      <ol rindStepperList>
        @for (t of titles; track t; let i = $index) {
          <li rindStepperItem [index]="i" [disabled]="extras && i === 2" #item="rindStepperItem">
            @if (item.triggerIsButton()) {
              <button rindStepperTrigger>${TRIGGER_CONTENT}</button>
            } @else {
              <span rindStepperTrigger>${TRIGGER_CONTENT}</span>
            }
            @if (extras) {
              <span rindStepperDescription>{{ t }} step</span>
              <div rindStepperSeparator></div>
            }
          </li>
        }
      </ol>
      @for (t of titles; track t; let i = $index) {
        <div rindStepperContent [index]="i">{{ t }} details</div>
      }
      <button rindStepperPrevTrigger></button>
      <button rindStepperNextTrigger></button>
      @if (extras) {
        <span rindStepperProgress></span>
      }
    </div>
  </ng-container>`,
})
class Tree {
  readonly p = current.p
  readonly extras = current.extras
  readonly titles = TITLES
}
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
  describe(`angular stepper model: ${linear ? "linear" : "non-linear"}`, () => {
    testMachine(stepperContract, {
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () => {
        current = { p: { linear }, extras: false }
        return mount(Tree)
      },
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

describe("Angular Stepper matches React", () => {
  it("linear, non-linear, a step on, indicators, descriptions, a disabled step, progress", async () => {
    for (const [p, extras] of [
      [{}, false],
      [{ linear: false, defaultStep: 1 }, false],
      [{ defaultStep: 1, orientation: "vertical" }, true],
    ] as const) {
      current = { p, extras }
      await both(reactTree(p, extras), Tree)
    }
  })
})
