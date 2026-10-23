// Kbd: the same markup as @rind-ui/react, chords and sequences, both platforms.
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Kbd } from "../index"

const both = async (react: Parameters<typeof serverParity>[0], vue: () => ReturnType<typeof h>) => {
  await serverParity(react, vue)
  await clientParity(react, vue)
}

describe("Vue Kbd matches React", () => {
  it("chord, sequence, key list, children, platforms", async () => {
    for (const platform of ["apple", "other"] as const) {
      for (const keys of ["mod+shift+p", "g i", ["ctrl", "enter"]] as const) {
        await both(r(R.Kbd.Root, { keys: keys as never, platform }), () =>
          h(Kbd.Root, { keys: keys as never, platform }),
        )
      }
    }
    await both(r(R.Kbd.Root, null, "Esc"), () => h(Kbd.Root, null, () => "Esc"))
  })
})
