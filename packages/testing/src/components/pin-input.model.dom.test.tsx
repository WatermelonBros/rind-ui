// Model-based tests: the Pin Input contract over the configurations of design §5 (task 6.1).
// jsdom has no layout, so it runs the keyboard paths only (a pointer press maps by geometry).
import { pinInputContract, pinInputMessages, platforms } from "@rind-ui/core"
import { Field, PinInput, type PinInputRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { useState } from "react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Config = Partial<PinInputRootProps> & {
  readonly controlled?: boolean
  readonly inField?: boolean
  readonly rtl?: boolean
}

// The oracle runs the real machine, so it needs every prop the machine reads.
const oracle = (cfg: Config) => ({
  length: cfg.length ?? 6,
  validationType: cfg.validationType,
  pattern: undefined,
  sanitize: cfg.sanitize,
  value: undefined,
  defaultValue: cfg.defaultValue ?? "12",
  onValueChange: undefined,
  onValueInvalid: undefined,
  onValueComplete: undefined,
  autoSubmit: undefined,
  disabled: undefined,
  readOnly: cfg.readOnly,
  messages: pinInputMessages,
  id: "pin",
  writeCaret: () => {},
  resync: () => {},
  requestSubmit: undefined,
})

function Code({ cfg }: { cfg: Config }) {
  const { controlled, inField, rtl, ...props } = cfg
  const length = props.length ?? 6
  const [value, setValue] = useState(props.defaultValue ?? "12")
  const root = {
    ...props,
    length,
    ...(controlled
      ? { value, onValueChange: setValue }
      : { defaultValue: props.defaultValue ?? "12" }),
  }
  const control = (
    <PinInput.Control style={{ display: "flex", gap: 4, width: length * 44 }}>
      <PinInput.Input />
      {Array.from({ length }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: slots are positions
        <PinInput.Slot key={i} index={i} style={{ width: 40, height: 40 }} />
      ))}
    </PinInput.Control>
  )
  // Inside the Root: the runner's "focus stays in the component" sees a reset as inside.
  const reset = <button type="reset">Reset</button>
  const body = inField ? (
    <Field.Root>
      <Field.Label>Verification code</Field.Label>
      <PinInput.Root {...root}>
        {control}
        {reset}
      </PinInput.Root>
      <Field.ErrorMessage />
    </Field.Root>
  ) : (
    <PinInput.Root {...root}>
      <PinInput.Label>Verification code</PinInput.Label>
      {control}
      {reset}
    </PinInput.Root>
  )
  return (
    <form onSubmit={(e) => e.preventDefault()} dir={rtl ? "rtl" : undefined}>
      {body}
    </form>
  )
}

function config(name: string, cfg: Config) {
  describe(`pin-input model: ${name}`, () => {
    testMachine(pinInputContract, {
      test: it,
      setup: () =>
        render(
          <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
            <Code cfg={cfg} />
          </RindProvider>,
        ),
      target: () => screen,
      anchor: [{ name: "Verification code" }],
      props: oracle(cfg) as never,
      a11y,
      ...(inJsdom ? { modalities: ["keyboard"] } : {}),
    } as never)
  })
}

config("numeric, length 6", {})
config("alphanumeric, uppercased", {
  validationType: "alphanumeric",
  sanitize: (t) => t.toUpperCase(),
  defaultValue: "AB",
})
config("masked PIN, length 4", { length: 4, mask: true, autoComplete: "off" })
config("controlled, applying every proposal", { controlled: true })
config("read-only", { readOnly: true })
config("inside a Field with an ErrorMessage", { inField: true })
config("right-to-left page", { rtl: true })
