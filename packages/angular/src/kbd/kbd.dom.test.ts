// Kbd: the same markup as @rind-ui/react, chords and sequences, both platforms.
import { Component } from "@angular/core"
import type { KbdKeys } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { both } from "../../fixtures/parity"
import { Kbd } from "./kbd"

/** What the next render shows (a server render cannot set inputs). */
let current: { keys: KbdKeys; platform: "apple" | "other" } = { keys: "", platform: "other" }

@Component({
  selector: "rind-f",
  imports: [Kbd],
  template: `<kbd rindKbdRoot [keys]="keys" [platform]="platform"></kbd>`,
})
class Keys {
  readonly keys = current.keys
  readonly platform = current.platform
}
@Component({ selector: "rind-f", imports: [Kbd], template: `<kbd rindKbdRoot>Esc</kbd>` })
class Text {}

describe("Angular Kbd matches React", () => {
  it("chord, sequence, key list, children, platforms", async () => {
    for (const platform of ["apple", "other"] as const) {
      for (const keys of ["mod+shift+p", "g i", ["ctrl", "enter"]] as const) {
        current = { keys: keys as KbdKeys, platform }
        await both(r(R.Kbd.Root, { keys: keys as never, platform }), Keys)
      }
    }
    await both(r(R.Kbd.Root, null, "Esc"), Text)
  })
})
