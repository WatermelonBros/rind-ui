// The Number Input contract model (React's matrix) against the Vue parts, and markup parity.
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
import { defineComponent, h, type PropType, shallowRef, type VNode } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Field, NumberInput, RindProvider } from "../index"

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
type P = Record<string, unknown>
const parts = () =>
  h(NumberInput.Control, null, () => [
    h(NumberInput.DecrementTrigger, null, () => "−"),
    h(NumberInput.Input),
    h(NumberInput.IncrementTrigger, null, () => "+"),
  ])
const input = (p: P) =>
  h(NumberInput.Root, { name: "q", ...p }, () => [
    h(NumberInput.Label, null, () => "Quantity"),
    parts(),
  ])
const fixture = (p: P) => h("form", null, [input(p), h("button", { type: "reset" }, "Reset")])
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
/** Controlled by a parent that applies every proposal. */
const Parent = defineComponent({
  props: { p: { type: Object as PropType<P>, required: true } },
  setup(props) {
    const value = shallowRef<number | null>((props.p["defaultValue"] as number | undefined) ?? null)
    return () =>
      fixture({
        ...props.p,
        modelValue: value.value,
        "onUpdate:modelValue": (v: number | null) => (value.value = v),
      })
  },
})
interface Config {
  readonly name: string
  readonly props: P
  readonly ui?: (props: P) => VNode
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
  { name: "controlled, applying", props: { defaultValue: 2 }, ui: (p) => h(Parent, { p }) },
  {
    name: "inside a Field (change mode)",
    props: { defaultValue: 2 },
    ui: (p) =>
      h(Field.Root, { validationMode: "change" }, () => [
        h(Field.Label, null, () => "Quantity"),
        h(NumberInput.Root, { name: "q", ...p }, () => parts()),
        h("button", { type: "button" }, "Reset"),
      ]),
  },
  {
    name: "iOS (quirk: textbox)",
    props: { defaultValue: 1 },
    role: "textbox",
    platform: platforms.ios,
  },
  { name: "Android", props: { defaultValue: 1 }, platform: platforms.android },
]
/** React's `readOnly` is Vue's `readonly`. */
const vueProps = ({ readOnly, ...p }: P) =>
  readOnly === undefined ? p : { ...p, readonly: readOnly }

for (const cfg of configs) {
  describe(`vue number-input model: ${cfg.name}`, () => {
    let pageChanges = 0
    let oracleChanges = 0
    const steps = numberInputStepInvariants({
      changes: () => pageChanges,
      expectedChanges: () => oracleChanges,
    })
    const { locale = "en-US", ...rest } = cfg.props
    const parser = createNumberParser(
      locale as string,
      rest["formatOptions"] as Intl.NumberFormatOptions | undefined,
    )
    testMachine(contractFor(cfg.role ?? "spinbutton"), {
      test: it,
      clock,
      setup: () => {
        steps.reset()
        pageChanges = 0
        oracleChanges = 0
        const props = { ...vueProps(rest), locale, onValueChange: () => pageChanges++ }
        return mount(() =>
          h(
            RindProvider,
            {
              environment: {
                platform: currentRun()?.platform ?? platforms.linux,
                scheduler: clock.scheduler,
              },
            },
            () => (cfg.ui ? cfg.ui(props) : fixture(props)),
          ),
        )
      },
      target: () => screen,
      anchor: [{ name: "Quantity", ...(cfg.role ? { role: cfg.role } : {}) }] as never,
      props: {
        value: undefined,
        defaultValue: rest["defaultValue"] ?? null,
        min: rest["min"],
        max: rest["max"],
        step: rest["step"],
        largeStep: undefined,
        commitBehavior: rest["commitBehavior"],
        spinOnPress: rest["spinOnPress"],
        disabled: undefined,
        readOnly: rest["readOnly"],
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

describe("Vue Number Input matches React", () => {
  it("empty, bounds, percent, read-only, disabled, required, errors", async () => {
    for (const p of [
      {},
      { defaultValue: 5, min: 0, max: 10 },
      { defaultValue: 0.5, formatOptions: { style: "percent" } },
      { defaultValue: 4, readOnly: true },
      { disabled: true, required: true, errors: ["Too many"] },
    ] as P[]) {
      await serverParity(reactInput(p), () => input(vueProps(p)))
      await clientParity(reactInput(p), () => input(vueProps(p)))
    }
  })
})
