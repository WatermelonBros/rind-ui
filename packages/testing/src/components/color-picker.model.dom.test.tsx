// Model-based tests (add-color-picker 9.1): the Color Picker contract (open, close, format,
// reset) in every modality the actions declare; the children are walked by their own models.
import { colorPickerContract, parseColor, platforms } from "@rind-ui/core"
import { ColorPicker, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

for (const cfg of [
  { name: "popover", defaultFormat: "hex" },
  { name: "popover, hsl first", defaultFormat: "hsl" },
] as const) {
  describe(`color picker model: ${cfg.name}`, () => {
    testMachine(colorPickerContract, {
      test: it,
      setup: () =>
        render(
          <RindProvider
            dir={currentRun()?.direction ?? "ltr"}
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
          >
            <form>
              <ColorPicker.Root
                name="fill"
                defaultValue="#336699"
                defaultFormat={cfg.defaultFormat}
              >
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
              <button type="reset">Reset</button>
            </form>
          </RindProvider>,
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
