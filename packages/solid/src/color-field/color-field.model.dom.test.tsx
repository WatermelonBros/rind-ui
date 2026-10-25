/** @jsxImportSource solid-js */
// Model-based tests (React's, against the Solid parts): the Color Field contract, hex and hex
// with alpha, by keyboard.
import { parseColor, platforms } from "@rind-ui/core"
import { colorFieldContract } from "@rind-ui/core/internal"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../index"
import { ColorField } from "./color-field"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type PartLike = {
  focus(): Promise<void>
  press(key: "End" | "Backspace"): Promise<void>
  value(): Promise<string>
  compose(updates: readonly string[], commit?: string): Promise<void>
}
// `Part.type` clicks a text field first (a pointer modality: no data-focus-visible after a
// keyboard step) and `press` knows a closed key set: a committed composition is the keyboard
// path, as in the Text Field's model test.
const keys = async (env: { part(name: "input"): PartLike }, text: string) => {
  const input = env.part("input")
  await input.focus()
  await input.press("End")
  for (let n = (await input.value()).length; n > 0; n--) await input.press("Backspace")
  if (text !== "")
    await input.compose(
      [...text].map((_, i) => text.slice(0, i + 1)),
      text,
    )
}
const keyedContract = {
  ...colorFieldContract,
  actions: {
    ...colorFieldContract.actions,
    type: { ...colorFieldContract.actions.type, keyboard: keys },
  },
} as unknown as typeof colorFieldContract

for (const cfg of [
  { name: "hex", defaultValue: "#112233", alpha: false },
  { name: "hex with alpha", defaultValue: "#11223380", alpha: true },
]) {
  describe(`solid color field model: ${cfg.name}`, () => {
    testMachine(keyedContract, {
      test: it,
      setup: () =>
        mount(() => (
          // The run's platform: the late commit Enter after a composition is Safari's only.
          <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
            <form>
              <ColorField.Root name="fill" defaultValue={cfg.defaultValue} alpha={cfg.alpha}>
                <ColorField.Label>Fill</ColorField.Label>
                <ColorField.Input />
              </ColorField.Root>
              <button type="reset">Reset</button>
            </form>
          </RindProvider>
        )),
      target: () => screen,
      anchor: [{ name: "Fill" }] as never,
      props: {
        value: undefined,
        defaultValue: parseColor(cfg.defaultValue),
        format: "hex",
        alpha: cfg.alpha,
        disabled: undefined,
        readOnly: undefined,
      } as never,
      modalities: ["keyboard"] as const,
      a11y,
    })
  })
}
