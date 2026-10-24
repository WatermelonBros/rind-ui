// Model-based tests (React's, against the Vue parts): the Color Swatch Picker is the Radio
// Group contract with colour items; every modality, LTR and RTL. The oracle's items are the
// swatches' keys (`#RRGGBBAA`), named by their colours.
import { createListCollection, platforms, radioGroupArgs } from "@rind-ui/core"
import { colorSwatchPickerContract } from "@rind-ui/core/internal"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../index"
import { ColorSwatchPicker } from "./color-swatch-picker"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const SWATCHES = [
  { key: "#FF0000FF", color: "#FF0000", label: "vibrant red" },
  { key: "#00FF00FF", color: "#00FF00", label: "vibrant green" },
  { key: "#0000FFFF", color: "#0000FF", label: "vibrant blue" },
]
const BLUE = { key: "#0000FFFF", label: "vibrant blue" }

interface Cfg {
  readonly defaultValue?: string
  readonly disabled?: readonly string[]
}

const palette = (cfg: Cfg) => () =>
  h(
    RindProvider,
    {
      dir: currentRun()?.direction ?? "ltr",
      environment: { platform: currentRun()?.platform ?? platforms.linux },
    },
    () =>
      h("form", [
        h(
          ColorSwatchPicker.Root,
          {
            "aria-label": "Palette",
            name: "c",
            ...(cfg.defaultValue ? { defaultValue: cfg.defaultValue } : {}),
          },
          () =>
            SWATCHES.map((s) =>
              h(
                ColorSwatchPicker.Item,
                { key: s.key, color: s.color, disabled: cfg.disabled?.includes(s.key) === true },
                () => [
                  h(ColorSwatchPicker.Swatch),
                  h(ColorSwatchPicker.Indicator, null, () => "✓"),
                ],
              ),
            ),
        ),
        h("button", { type: "button" }, "After"),
      ]),
  )

const configs: { name: string; cfg: Cfg }[] = [
  { name: "no match", cfg: {} },
  { name: "red", cfg: { defaultValue: "#FF0000" } },
  { name: "first disabled", cfg: { defaultValue: "#00FF00", disabled: ["#FF0000FF"] } },
]

for (const { name, cfg } of configs) {
  describe(`vue color swatch picker model: ${name}`, () => {
    testMachine(colorSwatchPickerContract, {
      test: it,
      setup: () => {
        radioGroupArgs.current = BLUE
        return mount(palette(cfg))
      },
      target: () => screen,
      anchor: [{ name: "Palette" }] as never,
      props: {
        collection: createListCollection({
          items: SWATCHES,
          getKey: (i) => i.key,
          getText: (i) => i.label,
          isDisabled: (i) => cfg.disabled?.includes(i.key) === true,
        }),
        strategy: "roving",
        ids: { list: "root", item: (k: string) => `item-${k}` },
        loop: true,
        selectionMode: "single",
        focusableWhenDisabled: false,
        value: undefined,
        defaultValue: cfg.defaultValue ? `${cfg.defaultValue}FF` : undefined,
        onValueChange: undefined,
        disabled: false,
        readOnly: false,
      } as never,
      a11y,
    })
  })
}
