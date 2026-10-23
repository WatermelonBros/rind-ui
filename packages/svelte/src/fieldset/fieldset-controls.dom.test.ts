// A machine event sent from inside an effect (Button's FIELDSET.CHANGE on mount) must not make
// that effect depend on the service's version: it looped (effect_update_depth_exceeded).
import { screen } from "@testing-library/dom"
import { describe, expect, it } from "vitest"
import Controls from "../../fixtures/fieldset/controls.svelte"
import { mount } from "../../fixtures/mount"

describe("controls inside a disabled fieldset", () => {
  for (const which of ["button", "toggle", "native", "plain"]) {
    it(`${which}: mounts disabled`, () => {
      mount(Controls, { which })
      expect(screen.getByRole("button", { name: "Go" }).hasAttribute("data-disabled")).toBe(true)
    })
  }
})
