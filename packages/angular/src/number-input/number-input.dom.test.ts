// The Number Input contract model (React's matrix) against the Angular parts, and markup parity.
import { Component, signal } from "@angular/core"
import {
  createNumberParser,
  numberInputContract,
  numberInputMessages,
  platforms,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, numberInputStepInvariants, testMachine, virtualClock } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Field } from "../field/field"
import { RindProvider } from "../provider"
import { NumberInput } from "./number-input"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const clock = virtualClock()
type PartLike = {
  compose(updates: readonly string[], commit?: string): Promise<void>
  focus(): Promise<void>
}
type EnvLike = { find(by: { role: string; name: string }): PartLike }
/** As in React's model: typing is a committed one-character-at-a-time composition. */
const keyed = (role: "spinbutton" | "textbox") => async (env: EnvLike, text: string) => {
  const input = env.find({ role, name: "Quantity" })
  await input.focus()
  await input.compose(
    [...text].map((_, i) => text.slice(0, i + 1)),
    text,
  )
}
/** jsdom has no layout: stepper presses and holds are walked in browser mode only. */
function contractFor(role: "spinbutton" | "textbox") {
  const base = numberInputContract
  const c = {
    ...base,
    actions: { ...base.actions, type: { ...base.actions.type, keyboard: keyed(role) } },
    events: inJsdom
      ? { ...base.events, "PRESS.START": { skip: "no layout in jsdom: walked in browser mode" } }
      : base.events,
    ...(role === "textbox" ? { traits: base.traits.filter((t) => t !== "valued") } : {}),
  }
  return c as unknown as typeof numberInputContract
}
interface P {
  readonly defaultValue?: number
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly formatOptions?: Intl.NumberFormatOptions
  readonly locale?: string
  readonly commitBehavior?: "snap" | "validate"
  readonly spinOnPress?: boolean
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly required?: boolean
  readonly errors?: readonly string[]
}
type Ui = "plain" | "form" | "controlled" | "field"
/** The configuration the next fixture renders. */
let current: { p: P; ui: Ui; onChange: () => void } = { p: {}, ui: "plain", onChange: () => {} }

const ROOT_INPUTS = `name="q"
      [defaultValue]="p.defaultValue ?? null"
      [min]="p.min"
      [max]="p.max"
      [step]="p.step"
      [formatOptions]="p.formatOptions"
      [locale]="p.locale"
      [commitBehavior]="p.commitBehavior"
      [spinOnPress]="p.spinOnPress"
      [readonly]="p.readOnly ?? false"
      [disabled]="p.disabled ?? false"
      [required]="p.required ?? false"
      [errors]="p.errors"
      [value]="controlled ? value() : undefined"
      (valueChange)="changed($event)"`
const PARTS = `<div rindNumberInputControl>
        <button rindNumberInputDecrementTrigger>−</button>
        <input rindNumberInputInput />
        <button rindNumberInputIncrementTrigger>+</button>
      </div>`
const INPUT = `<div rindNumberInputRoot ${ROOT_INPUTS}>
      <label rindNumberInputLabel>Quantity</label>
      ${PARTS}
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Field, NumberInput],
  template: `<ng-container rindProvider [environment]="env">
    @switch (ui) {
      @case ("plain") {
        ${INPUT}
      }
      @case ("field") {
        <div rindFieldRoot validationMode="change">
          <label rindFieldLabel>Quantity</label>
          <div rindNumberInputRoot ${ROOT_INPUTS}>${PARTS}</div>
          <button type="button">Reset</button>
        </div>
      }
      @default {
        <form>${INPUT}<button type="reset">Reset</button></form>
      }
    }
  </ng-container>`,
})
class Tree {
  readonly env = {
    platform: currentRun()?.platform ?? platforms.linux,
    scheduler: clock.scheduler,
  }
  readonly p = current.p
  readonly ui = current.ui
  readonly controlled = current.ui === "controlled"
  readonly value = signal<number | null>(current.p.defaultValue ?? null)
  private readonly onChange = current.onChange
  changed(v: number | null) {
    this.onChange()
    if (this.controlled) this.value.set(v)
  }
}
const reactInput = (p: P) =>
  r(
    R.NumberInput.Root,
    { name: "q", ...p } as never,
    r(R.NumberInput.Label, null, "Quantity"),
    r(
      R.NumberInput.Control,
      null,
      r(R.NumberInput.DecrementTrigger, null, "−"),
      r(R.NumberInput.Input),
      r(R.NumberInput.IncrementTrigger, null, "+"),
    ),
  )
interface Config {
  readonly name: string
  readonly props: P
  readonly ui?: Ui
  readonly role?: "textbox"
  readonly platform?: (typeof platforms)[keyof typeof platforms]
}
const configs: Config[] = [
  { name: "uncontrolled empty", props: {} },
  { name: "integers in [0, 10]", props: { defaultValue: 5, min: 0, max: 10, step: 1 } },
  { name: "decimal step 0.1", props: { defaultValue: 1, step: 0.1 } },
  { name: "percent", props: { defaultValue: 0.5, formatOptions: { style: "percent" } } },
  {
    name: "de-DE currency",
    props: {
      defaultValue: 9,
      locale: "de-DE",
      formatOptions: { style: "currency", currency: "EUR" },
    },
  },
  { name: "ar-EG digits", props: { defaultValue: 3, locale: "ar-EG" } },
  { name: "validate", props: { defaultValue: 5, max: 10, commitBehavior: "validate" } },
  { name: "no press-and-hold", props: { defaultValue: 0, spinOnPress: false } },
  { name: "read-only", props: { defaultValue: 4, readOnly: true } },
  { name: "controlled, applying", props: { defaultValue: 2 }, ui: "controlled" },
  { name: "inside a Field (change mode)", props: { defaultValue: 2 }, ui: "field" },
  {
    name: "iOS (quirk: textbox)",
    props: { defaultValue: 1 },
    role: "textbox",
    platform: platforms.ios,
  },
  { name: "Android", props: { defaultValue: 1 }, platform: platforms.android },
]

for (const cfg of configs) {
  describe(`angular number-input model: ${cfg.name}`, () => {
    let pageChanges = 0
    let oracleChanges = 0
    const steps = numberInputStepInvariants({
      changes: () => pageChanges,
      expectedChanges: () => oracleChanges,
    })
    const { locale = "en-US", ...rest } = cfg.props
    const parser = createNumberParser(locale, rest.formatOptions)
    testMachine(contractFor(cfg.role ?? "spinbutton"), {
      test: it,
      clock,
      setup: () => {
        steps.reset()
        pageChanges = 0
        oracleChanges = 0
        current = { p: { ...rest, locale }, ui: cfg.ui ?? "form", onChange: () => pageChanges++ }
        return mount(Tree)
      },
      target: () => screen,
      anchor: [{ name: "Quantity", ...(cfg.role ? { role: cfg.role } : {}) }] as never,
      props: {
        value: undefined,
        defaultValue: rest.defaultValue ?? null,
        min: rest.min,
        max: rest.max,
        step: rest.step,
        largeStep: undefined,
        commitBehavior: rest.commitBehavior,
        spinOnPress: rest.spinOnPress,
        disabled: undefined,
        readOnly: rest.readOnly,
        parser,
        messages: numberInputMessages,
        id: "oracle",
        onValueChange: () => {
          oracleChanges++
        },
      } as never,
      ...(cfg.platform ? { platforms: [cfg.platform] } : {}),
      ...(inJsdom
        ? { modalities: ["keyboard"] as const }
        : cfg.platform === platforms.ios
          ? { modalities: ["pointer", "keyboard", "virtual"] as const }
          : {}),
      invariants: steps.invariants,
      a11y,
    })
  })
}

describe("Angular Number Input matches React", () => {
  it("empty, bounds, percent, read-only, disabled, required, errors", async () => {
    for (const p of [
      {},
      { defaultValue: 5, min: 0, max: 10 },
      { defaultValue: 0.5, formatOptions: { style: "percent" } },
      { defaultValue: 4, readOnly: true },
      { disabled: true, required: true, errors: ["Too many"] },
    ] as P[]) {
      current = { p, ui: "plain", onChange: () => {} }
      await both(reactInput(p), Tree)
    }
  })
})
