/** @jsxImportSource solid-js */
// Model-based tests (React's, against the Solid parts): the Color Picker contract, a popover
// picker with a format trigger and a hex input.
import { colorPickerContract, parseColor, platforms } from "@rind-ui/core"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { ColorPicker, type ColorPickerRootProps, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

export const pickerExample = (root: ColorPickerRootProps): JSX.Element => (
  <ColorPicker.Root {...root}>
    <ColorPicker.Label>Fill</ColorPicker.Label>
    <ColorPicker.Control>
      <ColorPicker.Trigger>
        <ColorPicker.ValueSwatch />
      </ColorPicker.Trigger>
      <ColorPicker.ValueText />
    </ColorPicker.Control>
    <ColorPicker.Portal>
      <ColorPicker.Positioner>
        <ColorPicker.Content>
          <ColorPicker.FormatTrigger />
          <ColorPicker.ChannelInput channel="hex" />
        </ColorPicker.Content>
      </ColorPicker.Positioner>
    </ColorPicker.Portal>
  </ColorPicker.Root>
)

for (const cfg of [
  { name: "popover", defaultFormat: "hex" },
  { name: "popover, hsl first", defaultFormat: "hsl" },
] as const) {
  describe(`solid color picker model: ${cfg.name}`, () => {
    testMachine(colorPickerContract, {
      test: it,
      setup: () =>
        mount(() => (
          <RindProvider
            dir={currentRun()?.direction ?? "ltr"}
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
          >
            <form>
              {pickerExample({
                name: "fill",
                defaultValue: "#336699",
                defaultFormat: cfg.defaultFormat,
              })}
              <button type="reset">Reset</button>
            </form>
          </RindProvider>
        )),
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
