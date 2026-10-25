// Model-based tests (React's, against the Angular parts): the Color Picker contract, a popover
// picker with a format trigger and a hex input.
import { Component } from "@angular/core"
import { colorPickerContract, parseColor, platforms } from "@rind-ui/core"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { ColorPicker } from "./index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const configs = [
  { name: "popover", defaultFormat: "hex" },
  { name: "popover, hsl first", defaultFormat: "hsl" },
] as const
/** The configuration the next fixture renders. */
let current: (typeof configs)[number] = configs[0]

@Component({
  selector: "rind-f",
  imports: [RindProvider, ColorPicker],
  template: `<ng-container rindProvider [dir]="dir" [environment]="env">
    <form>
      <div rindColorPickerRoot name="fill" defaultValue="#336699" [defaultFormat]="cfg.defaultFormat">
        <label rindColorPickerLabel>Fill</label>
        <div rindColorPickerControl>
          <button rindColorPickerTrigger><div rindColorPickerValueSwatch></div></button>
          <span rindColorPickerValueText></span>
        </div>
        <ng-template rindColorPickerPortal>
          <div rindColorPickerPositioner>
            <div rindColorPickerContent>
              <button rindColorPickerFormatTrigger></button>
              <div rindColorPickerChannelInput channel="hex"></div>
            </div>
          </div>
        </ng-template>
      </div>
      <button type="reset">Reset</button>
    </form>
  </ng-container>`,
})
class Fixture {
  readonly cfg = current
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
}

for (const cfg of configs) {
  describe(`angular color picker model: ${cfg.name}`, () => {
    testMachine(colorPickerContract, {
      test: it,
      setup: () => {
        current = cfg
        return mount(Fixture)
      },
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
