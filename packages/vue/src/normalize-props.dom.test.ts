// Neutral handler keys become Vue listener keys; a capture-phase handler keeps Vue's `Capture`
// modifier (lower-cased, it listened to a `clickcapture` event that never fires).
import { describe, expect, it } from "vitest"
import { h } from "vue"
import { mount } from "../fixtures/mount"
import { normalizeProps } from "./normalize-props"

describe("Vue normalizeProps", () => {
  it("maps handler keys, keeping the capture modifier", () => {
    const fn = () => {}
    const keys = Object.keys(
      normalizeProps({
        onKeyDown: fn,
        onFocusIn: fn,
        onClickCapture: fn,
        onPointerDownCapture: fn,
        onLostPointerCapture: fn,
      } as never),
    )
    expect(keys).toEqual([
      "onKeydown",
      "onFocusin",
      "onClickCapture",
      "onPointerdownCapture",
      "onLostpointercapture",
    ])
  })

  it("a capture handler runs before the target's, and can stop the click", () => {
    const calls: string[] = []
    const view = mount(() =>
      h(
        "div",
        normalizeProps({
          onClickCapture: (e: Event) => {
            calls.push("capture")
            e.stopPropagation()
          },
        } as never),
        [h("button", { type: "button", onClick: () => calls.push("target") }, "Go")],
      ),
    )
    view.host.querySelector("button")?.click()
    expect(calls).toEqual(["capture"])
  })
})
