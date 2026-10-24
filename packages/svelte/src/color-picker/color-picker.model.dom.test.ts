// Model-based tests (React's, against the Svelte parts): the Color Picker contract, a popover
// picker with a format trigger and a hex input.
import { colorPickerContract, parseColor } from "@rind-ui/core"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, it } from "vitest"
import Picker from "../../fixtures/color/picker.svelte"
import { mount } from "../../fixtures/mount"

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
  describe(`svelte color picker model: ${cfg.name}`, () => {
    testMachine(colorPickerContract, {
      test: it,
      setup: () =>
        mount(Picker, {
          root: { name: "fill", defaultValue: "#336699", defaultFormat: cfg.defaultFormat },
        } as never),
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
