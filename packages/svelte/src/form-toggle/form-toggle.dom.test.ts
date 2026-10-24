// The public FormToggle parts: a toggle built from them with Switch's config renders what
// Switch renders.
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Star from "../../fixtures/form-toggle/star.svelte"
import { clientParity } from "../../fixtures/parity"

describe("Svelte FormToggle", () => {
  it("built with Switch's config, matches React's Switch", async () => {
    for (const p of [{}, { defaultChecked: true }, { disabled: true }]) {
      await clientParity(
        r(
          R.Switch.Root,
          p,
          r(R.Switch.Control, null, r(R.Switch.Thumb)),
          r(R.Switch.Label, null, "Notifications"),
        ),
        Star,
        { root: p } as never,
      )
    }
  })
})
