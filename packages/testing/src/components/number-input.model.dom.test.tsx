// Model-based tests (task 6.1): the Number Input contract over the configurations of design
// §6. jsdom (no layout) walks keyboard edges; browser mode adds stepper presses and holds,
// with long spin timings so each step's checks finish before the next real-time tick.
import {
  createNumberParser,
  numberInputContract,
  numberInputMessages,
  platforms,
} from "@rind-ui/core"
import { Field, NumberInput, type NumberInputRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { type ReactElement, useState } from "react"
import { describe, it } from "vitest"
import { currentRun, numberInputStepInvariants, testMachine, virtualClock } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

// Press-and-hold delays (`after:*` edges) run on a virtual clock: the runner advances it,
// no real time passes.
const clock = virtualClock()

type PartLike = {
  compose(updates: readonly string[], commit?: string): Promise<void>
  focus(): Promise<void>
}
type EnvLike = { find(by: { role: string; name: string }): PartLike }

/**
 * As in the Text Field model: the runner replays every `type` on a text part as an open IME
 * composition that must change nothing, which a text input legitimately does. Typing is
 * re-expressed as a committed one-character composition through `find` (not replayed).
 */
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
    events: {
      ...base.events,
      ...(inJsdom ? { "PRESS.START": { skip: "no layout in jsdom: walked in browser mode" } } : {}),
      // Walking the 600 ms touch hold also passes the 400 ms pointer hold in the page, which
      // the oracle does not see: the touch twin is covered by the machine tests.
      "after:touchSpinDelay": {
        skip: "the touch hold: machine tests (the pointer hold is walked)",
      },
    },
    // The iOS quirk drops the spinbutton role and value attributes by design.
    ...(role === "textbox" ? { traits: base.traits.filter((t) => t !== "valued") } : {}),
  }
  return c as unknown as typeof numberInputContract
}

function Fixture({
  label = "Quantity",
  ...props
}: NumberInputRootProps & { readonly label?: string }) {
  return (
    <form>
      <NumberInput.Root name="q" {...props}>
        <NumberInput.Label>{label}</NumberInput.Label>
        <NumberInput.Control>
          <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
          <NumberInput.Input />
          <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
        </NumberInput.Control>
      </NumberInput.Root>
      <button type="reset">Reset</button>
    </form>
  )
}

/** Controlled by a parent that applies every proposal, or caps it (zag#3444). */
function Parent({ cap, ...props }: NumberInputRootProps & { readonly cap?: number }) {
  const [value, setValue] = useState<number | null>(props.defaultValue ?? null)
  return (
    <Fixture
      {...props}
      value={value}
      onValueChange={(v, d) => {
        setValue(v === null || cap === undefined ? v : Math.min(v, cap))
        props.onValueChange?.(v, d)
      }}
    />
  )
}

const withRun = (ui: ReactElement) => (
  <RindProvider
    environment={{
      platform: currentRun()?.platform ?? platforms.linux,
      scheduler: clock.scheduler,
    }}
  >
    {ui}
  </RindProvider>
)

interface Config {
  readonly name: string
  readonly props: NumberInputRootProps & { readonly locale?: string }
  readonly ui?: (props: NumberInputRootProps) => ReactElement
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
  { name: "controlled, applying", props: { defaultValue: 2 }, ui: (p) => <Parent {...p} /> },
  {
    name: "inside a Field (change mode)",
    props: { defaultValue: 2 },
    ui: (p) => (
      <Field.Root validationMode="change">
        <Field.Label>Quantity</Field.Label>
        <NumberInput.Root name="q" {...p}>
          <NumberInput.Control>
            <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
            <NumberInput.Input />
            <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
          </NumberInput.Control>
        </NumberInput.Root>
        <button type="button">Reset</button>
      </Field.Root>
    ),
  },
  {
    name: "iOS (quirk: textbox)",
    props: { defaultValue: 1 },
    role: "textbox",
    platform: platforms.ios,
  },
  { name: "Android", props: { defaultValue: 1 }, platform: platforms.android },
]

for (const cfg of configs) {
  describe(`number-input model: ${cfg.name}`, () => {
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
        const props = { ...rest, locale, onValueChange: () => pageChanges++ }
        return render(withRun(cfg.ui ? cfg.ui(props) : <Fixture {...props} />))
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
      // iOS touch presses restore the document's user-select 300 ms after the press
      // (press-interactions), after the step's document check: iOS runs without touch.
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
