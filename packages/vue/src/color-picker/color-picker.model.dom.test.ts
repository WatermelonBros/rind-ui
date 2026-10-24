// Model-based tests (React's, against the Vue parts): the Color Picker contract, a popover
// picker with a format trigger and a hex input.
import { colorPickerContract, parseColor, platforms } from "@rind-ui/core"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { ColorPicker, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

export const pickerExample = (root: Record<string, unknown>) =>
  h(ColorPicker.Root, root, () => [
    h(ColorPicker.Label, null, () => "Fill"),
    h(ColorPicker.Control, null, () => [
      h(ColorPicker.Trigger, null, () => h(ColorPicker.ValueSwatch)),
      h(ColorPicker.ValueText),
    ]),
    h(ColorPicker.Portal, null, () =>
      h(ColorPicker.Positioner, null, () =>
        h(ColorPicker.Content, null, () => [
          h(ColorPicker.FormatTrigger),
          h(ColorPicker.ChannelInput, { channel: "hex" }),
        ]),
      ),
    ),
  ])

for (const cfg of [
  { name: "popover", defaultFormat: "hex" },
  { name: "popover, hsl first", defaultFormat: "hsl" },
] as const) {
  describe(`vue color picker model: ${cfg.name}`, () => {
    testMachine(colorPickerContract, {
      test: it,
      setup: () =>
        mount(() =>
          h(
            RindProvider,
            {
              dir: currentRun()?.direction ?? "ltr",
              environment: { platform: currentRun()?.platform ?? platforms.linux },
            },
            () =>
              h("form", [
                pickerExample({
                  name: "fill",
                  defaultValue: "#336699",
                  defaultFormat: cfg.defaultFormat,
                }),
                h("button", { type: "reset" }, "Reset"),
              ]),
          ),
        ),
      target: () => screen,
      anchor: [{ name: "Fill" }] as never,
      props: {
        value: undefined,
        defaultValue: parseColor("#336699"),
        format: undefined,
        defaultFormat: cfg.defaultFormat,
        open: undefined,
        defaultOpen: undefined,
        inline: undefined,
        disabled: undefined,
        readOnly: undefined,
        closeOnSelect: undefined,
        onValueCommit: undefined,
      } as never,
      a11y,
    })
  })
}
