import { describe, expect, it } from "vitest"
import { baseDomEnvironment } from "./base-environment"
import type { Announcer, Clipboard, PlatformFlags } from "./capabilities"
import {
  announcerCapability,
  clipboardCapability,
  extendEnvironment,
  visibilityCapability,
} from "./dom-capabilities"
import { domEnvironment } from "./dom-environment"

const root = () => ({}) as Document
const platform = { engine: "blink", chromium: true } as PlatformFlags

describe("on-demand capabilities", () => {
  it("an implementation given in the options wins over the default", () => {
    const clipboard = { writeText: async () => {} } as unknown as Clipboard
    const announcer = { announce() {}, prepare: () => () => {}, cancel() {} } as Announcer
    const options = { getRootNode: root, clipboard, announcer }
    const base = baseDomEnvironment(options)
    expect(clipboardCapability.create(base, options)).toBe(clipboard)
    expect(announcerCapability.create(base, options)).toBe(announcer)
  })

  it("the base environment has no on-demand capability", () => {
    const env = baseDomEnvironment({ getRootNode: root })
    for (const key of ["announcer", "clipboard", "layout", "validity", "visibility", "dateClock"])
      expect(key in env).toBe(false)
  })

  it("domEnvironment has every capability", () => {
    const env = domEnvironment({ getRootNode: root })
    for (const key of ["announcer", "clipboard", "layout", "validity", "visibility", "dateClock"])
      expect(key in env).toBe(true)
  })

  it("extending keeps the platform lazy", () => {
    let reads = 0
    const base = baseDomEnvironment({
      getRootNode: root,
      get platform() {
        reads++
        return platform
      },
    })
    const env = extendEnvironment(base, {
      visibility: visibilityCapability.create(base, { getRootNode: root }),
    })
    expect(reads).toBe(0)
    expect(env.platform.chromium).toBe(true)
    expect(reads).toBe(1)
  })
})
