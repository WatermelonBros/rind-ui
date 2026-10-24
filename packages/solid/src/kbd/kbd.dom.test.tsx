/** @jsxImportSource solid-js */
// Kbd: the same markup as @rind-ui/react, chords and sequences, both platforms.
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { clientParity } from "../../fixtures/parity"
import { Kbd } from "../index"

describe("Solid Kbd matches React", () => {
  it("chord, sequence, key list, children, platforms", async () => {
    for (const platform of ["apple", "other"] as const) {
      for (const keys of ["mod+shift+p", "g i", ["ctrl", "enter"]] as const) {
        await clientParity(r(R.Kbd.Root, { keys: keys as never, platform }), () => (
          <Kbd.Root keys={keys as never} platform={platform} />
        ))
      }
    }
    await clientParity(r(R.Kbd.Root, null, "Esc"), () => <Kbd.Root>Esc</Kbd.Root>)
  })
})
