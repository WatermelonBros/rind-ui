// Model-based tests (React's, against the Angular parts): the Color Swatch Picker is the Radio
// Group contract with colour items; every modality, LTR and RTL. The oracle's items are the
// swatches' keys (`#RRGGBBAA`), named by their colours.
import { Component } from "@angular/core"
import { createListCollection, platforms, radioGroupArgs } from "@rind-ui/core"
import { colorSwatchPickerContract } from "@rind-ui/core/internal"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
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
/** The configuration the next palette renders. */
let current: Cfg = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, ColorSwatchPicker],
  template: `<ng-container rindProvider [dir]="dir" [environment]="env">
    <form>
      <div rindColorSwatchPickerRoot aria-label="Palette" name="c" [defaultValue]="cfg.defaultValue">
        @for (s of swatches; track s.key) {
          <div rindColorSwatchPickerItem [color]="s.color" [disabled]="cfg.disabled?.includes(s.key) === true">
            <div rindColorSwatchPickerSwatch></div>
            <span rindColorSwatchPickerIndicator>✓</span>
          </div>
        }
      </div>
      <button type="button">After</button>
    </form>
  </ng-container>`,
})
class Palette {
  readonly cfg = current
  readonly swatches = SWATCHES
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
}

const configs: { name: string; cfg: Cfg }[] = [
  { name: "no match", cfg: {} },
  { name: "red", cfg: { defaultValue: "#FF0000" } },
  { name: "first disabled", cfg: { defaultValue: "#00FF00", disabled: ["#FF0000FF"] } },
]

for (const { name, cfg } of configs) {
  describe(`angular color swatch picker model: ${name}`, () => {
    testMachine(colorSwatchPickerContract, {
      test: it,
      setup: () => {
        radioGroupArgs.current = BLUE
        current = cfg
        return mount(Palette)
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
