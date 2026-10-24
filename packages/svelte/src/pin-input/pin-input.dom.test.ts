// The Pin Input contract model (React's matrix) against the Svelte parts, and DOM parity.
import { pinInputContract, pinInputMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Code from "../../fixtures/pin-input/code.svelte"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type Config = Record<string, unknown> & {
  readonly length?: number
  readonly defaultValue?: string
  readonly controlled?: boolean
  readonly inField?: boolean
  readonly rtl?: boolean
}
const oracle = (cfg: Config) => ({
  length: cfg.length ?? 6,
  validationType: cfg["validationType"],
  pattern: undefined,
  sanitize: cfg["sanitize"],
  value: undefined,
  defaultValue: cfg.defaultValue ?? "12",
  onValueChange: undefined,
  onValueInvalid: undefined,
  onValueComplete: undefined,
  autoSubmit: undefined,
  disabled: undefined,
  readOnly: cfg["readonly"],
  messages: pinInputMessages,
  id: "pin",
  writeCaret: () => {},
  resync: () => {},
  requestSubmit: undefined,
})
function config(name: string, cfg: Config) {
  describe(`svelte pin-input model: ${name}`, () => {
    testMachine(pinInputContract, {
      test: it,
      setup: () => mount(Code, { cfg } as never),
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
  sanitize: (t: string) => t.toUpperCase(),
  defaultValue: "AB",
})
config("masked PIN, length 4", { length: 4, mask: true, autocomplete: "off" })
config("controlled, applying every proposal", { controlled: true })
config("read-only", { readonly: true })
config("inside a Field with an ErrorMessage", { inField: true })
config("right-to-left page", { rtl: true })

describe("Svelte Pin Input matches React", () => {
  // jsdom's CSS parser drops `background` from the Svelte style string the overlay input
  // carries (React sets each property): compared in real browsers only.
  it.skipIf(inJsdom)("numeric, masked, read-only, disabled, required", async () => {
    const reactTree = (p: Record<string, unknown>) =>
      r(
        R.PinInput.Root,
        { length: 4, ...p } as never,
        r(R.PinInput.Label, null, "Code"),
        r(
          R.PinInput.Control,
          null,
          r(R.PinInput.Input),
          [0, 1, 2, 3].map((i) => r(R.PinInput.Slot, { key: i, index: i })),
        ),
      )
    for (const [react, vue] of [
      [{}, {}],
      [
        { defaultValue: "12", mask: true, autoComplete: "off" },
        { defaultValue: "12", mask: true, autocomplete: "off" },
      ],
      [
        { defaultValue: "1234", readOnly: true },
        { defaultValue: "1234", readonly: true },
      ],
      [
        { disabled: true, required: true },
        { disabled: true, required: true },
      ],
    ] as const) {
      await clientParity(reactTree(react), Code, { parity: vue } as never)
    }
  })
})
