/** @jsxImportSource solid-js */
// The Pin Input contract model (React's matrix) against the Solid parts, a form submission and
// reset, and markup parity with @rind-ui/react.
import { pinInputContract, pinInputMessages, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { createSignal, For, type JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Field, PinInput, type PinInputRootProps, RindProvider } from "../index"

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
  readOnly: cfg["readOnly"],
  messages: pinInputMessages,
  id: "pin",
  writeCaret: () => {},
  resync: () => {},
  requestSubmit: undefined,
})
function Code(props: { cfg: Config }) {
  const { controlled, inField, rtl, ...p } = props.cfg
  const length = p.length ?? 6
  const [value, setValue] = createSignal(p.defaultValue ?? "12")
  const root = {
    ...p,
    length,
    ...(controlled
      ? {
          get value() {
            return value()
          },
          onValueChange: (v: string) => setValue(v),
        }
      : { defaultValue: p.defaultValue ?? "12" }),
  } as PinInputRootProps
  const control = () => (
    <PinInput.Control style={{ display: "flex", gap: "4px", width: `${length * 44}px` }}>
      <PinInput.Input />
      <For each={Array.from({ length }, (_, i) => i)}>
        {(i) => <PinInput.Slot index={i} style={{ width: "40px", height: "40px" }} />}
      </For>
    </PinInput.Control>
  )
  return (
    <form onSubmit={(e) => e.preventDefault()} dir={rtl ? "rtl" : undefined}>
      {inField ? (
        <Field.Root>
          <Field.Label>Verification code</Field.Label>
          <PinInput.Root {...root}>
            {control()}
            <button type="reset">Reset</button>
          </PinInput.Root>
          <Field.ErrorMessage />
        </Field.Root>
      ) : (
        <PinInput.Root {...root}>
          <PinInput.Label>Verification code</PinInput.Label>
          {control()}
          <button type="reset">Reset</button>
        </PinInput.Root>
      )}
    </form>
  )
}
function config(name: string, cfg: Config) {
  describe(`solid pin-input model: ${name}`, () => {
    testMachine(pinInputContract, {
      test: it,
      setup: () =>
        mount(() => (
          <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
            <Code cfg={cfg} />
          </RindProvider>
        )),
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
config("masked PIN, length 4", { length: 4, mask: true, autoComplete: "off" })
config("controlled, applying every proposal", { controlled: true })
config("read-only", { readOnly: true })
config("inside a Field with an ErrorMessage", { inField: true })
config("right-to-left page", { rtl: true })

const tree = (p: Record<string, unknown>): JSX.Element => (
  <PinInput.Root length={4} {...(p as Partial<PinInputRootProps>)}>
    <PinInput.Label>Code</PinInput.Label>
    <PinInput.Control>
      <PinInput.Input />
      <For each={[0, 1, 2, 3]}>{(i) => <PinInput.Slot index={i} />}</For>
    </PinInput.Control>
  </PinInput.Root>
)
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

describe("solid pin input in a form", () => {
  it("submits the code; reset restores the default; a controlled null clears", async () => {
    mount(() => (
      <form>
        <PinInput.Root length={4} name="code" defaultValue="12">
          <PinInput.Label>Code</PinInput.Label>
          <PinInput.Control>
            <PinInput.Input />
            <For each={[0, 1, 2, 3]}>{(i) => <PinInput.Slot index={i} />}</For>
          </PinInput.Control>
          <button type="reset">Reset</button>
        </PinInput.Root>
      </form>
    ))
    const form = document.querySelector("form") as HTMLFormElement
    expect(new FormData(form).get("code")).toBe("12")
    const input = screen.getByRole("textbox", { name: "Code" }) as HTMLInputElement
    input.focus()
    input.value = "1234"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await vi.waitFor(() => expect(new FormData(form).get("code")).toBe("1234"))
    screen.getByRole("button", { name: "Reset" }).click()
    await vi.waitFor(() => expect(new FormData(form).get("code")).toBe("12"))
  })

  it("a controlled value of null renders empty; an invalid length warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const [value, setValue] = createSignal<string | null>("12")
    mount(() => (
      <PinInput.Root
        length={4}
        {...({
          get value() {
            return value()
          },
        } as Partial<PinInputRootProps>)}
      >
        <PinInput.Label>Code</PinInput.Label>
        <PinInput.Control>
          <PinInput.Input />
          <PinInput.Slot index={0} />
        </PinInput.Control>
      </PinInput.Root>
    ))
    const input = screen.getByRole("textbox", { name: "Code" }) as HTMLInputElement
    expect(input.value).toBe("12")
    setValue(null)
    await vi.waitFor(() => expect(input.value).toBe(""))
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("length is 4 but 1 Slots")),
    )
    warn.mockRestore()
  })
})

describe("Solid Pin Input matches React", () => {
  it("numeric, masked, read-only, disabled, required", async () => {
    for (const [react, solid] of [
      [{}, {}],
      [{ defaultValue: "12", mask: true, autoComplete: "off" }, {}],
      [{ defaultValue: "1234", readOnly: true }, {}],
      [{ disabled: true, required: true }, {}],
    ] as const) {
      await clientParity(reactTree(react), () => tree({ ...react, ...solid }))
    }
  })
})
