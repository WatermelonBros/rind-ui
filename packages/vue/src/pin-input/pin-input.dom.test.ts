// The Pin Input contract model (React's matrix) against the Vue parts, and markup parity.
import { pinInputContract, pinInputMessages, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { defineComponent, h, type PropType, shallowRef } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Field, PinInput, RindProvider } from "../index"

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
const Code = defineComponent({
  props: { cfg: { type: Object as PropType<Config>, required: true } },
  setup(props) {
    const { controlled, inField, rtl, ...p } = props.cfg
    const length = p.length ?? 6
    const value = shallowRef(p.defaultValue ?? "12")
    return () => {
      const root = {
        ...p,
        length,
        ...(controlled
          ? { modelValue: value.value, "onUpdate:modelValue": (v: string) => (value.value = v) }
          : { defaultValue: p.defaultValue ?? "12" }),
      }
      const control = () =>
        h(
          PinInput.Control,
          { style: { display: "flex", gap: "4px", width: `${length * 44}px` } },
          () => [
            h(PinInput.Input),
            ...Array.from({ length }, (_, i) =>
              h(PinInput.Slot, { key: i, index: i, style: { width: "40px", height: "40px" } }),
            ),
          ],
        )
      const reset = () => h("button", { type: "reset" }, "Reset")
      const body = inField
        ? h(Field.Root, null, () => [
            h(Field.Label, null, () => "Verification code"),
            h(PinInput.Root, root, () => [control(), reset()]),
            h(Field.ErrorMessage),
          ])
        : h(PinInput.Root, root, () => [
            h(PinInput.Label, null, () => "Verification code"),
            control(),
            reset(),
          ])
      return h(
        "form",
        { onSubmit: (e: Event) => e.preventDefault(), dir: rtl ? "rtl" : undefined },
        [body],
      )
    }
  },
})
function config(name: string, cfg: Config) {
  describe(`vue pin-input model: ${name}`, () => {
    testMachine(pinInputContract, {
      test: it,
      setup: () =>
        mount(() =>
          h(
            RindProvider,
            { environment: { platform: currentRun()?.platform ?? platforms.linux } },
            () => h(Code, { cfg }),
          ),
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
  sanitize: (t: string) => t.toUpperCase(),
  defaultValue: "AB",
})
config("masked PIN, length 4", { length: 4, mask: true, autocomplete: "off" })
config("controlled, applying every proposal", { controlled: true })
config("read-only", { readonly: true })
config("inside a Field with an ErrorMessage", { inField: true })
config("right-to-left page", { rtl: true })

describe("Vue Pin Input matches React", () => {
  it("numeric, masked, read-only, disabled, required", async () => {
    const tree = (p: Record<string, unknown>) =>
      h(PinInput.Root, { length: 4, ...p }, () => [
        h(PinInput.Label, null, () => "Code"),
        h(PinInput.Control, null, () => [
          h(PinInput.Input),
          ...[0, 1, 2, 3].map((i) => h(PinInput.Slot, { key: i, index: i })),
        ]),
      ])
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
      await serverParity(reactTree(react), () => tree(vue))
      await clientParity(reactTree(react), () => tree(vue))
    }
  })
})
