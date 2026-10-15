import { afterEach, describe, expect, it, vi } from "vitest"
import type { ModalitySource } from "../env/capabilities"
import { focusSafely } from "./focus-safely"
import { modalityTracker } from "./modality"
import { platforms } from "./platform"

const inBrowser = !navigator.userAgent.includes("jsdom")
let off = () => {}
afterEach(() => {
  off()
  document.body.innerHTML = ""
})

function tracker(): ModalitySource {
  const t = modalityTracker(
    () => document,
    () => platforms.windows,
  )
  off = t.subscribe(() => {})
  return t
}

describe("focusSafely", () => {
  it("keeps the modality: a focus moved after a key stays keyboard", async () => {
    document.body.innerHTML = "<button>a</button><button>b</button>"
    const [a, b] = Array.from(document.querySelectorAll("button"))
    const modality = tracker()
    a?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }))
    if (b) await focusSafely(b, { modality })
    expect(document.activeElement).toBe(b)
    expect(modality.modality()).toBe("keyboard")
  })

  it("scrolls with the nearest-edge rule, instantly under reduced motion", async () => {
    document.body.innerHTML = "<button>a</button>"
    const el = document.querySelector("button") as HTMLElement
    const scroll = vi.spyOn(el, "scrollIntoView")
    const modality = tracker()
    const motion = (reduced: boolean) => ({
      reducedMotion: () => reduced,
      subscribeReducedMotion: () => () => {},
    })
    await focusSafely(el, { modality, motion: motion(true) })
    expect(scroll).toHaveBeenLastCalledWith({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    })
    await focusSafely(el, { modality, motion: motion(false) })
    expect(scroll).toHaveBeenLastCalledWith({
      block: "nearest",
      inline: "nearest",
      behavior: "auto",
    })
  })

  it.runIf(inBrowser)(
    "for assistive technology, waits for running transitions on the target",
    async () => {
      document.body.innerHTML = "<button>a</button>"
      const el = document.querySelector("button") as HTMLElement
      const modality = tracker()
      // A bare click: the modality is virtual.
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
      expect(modality.modality()).toBe("virtual")
      const animation = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 80 })
      const done = focusSafely(el, { modality })
      expect(document.activeElement).not.toBe(el)
      await animation.finished
      await done
      expect(document.activeElement).toBe(el)
    },
  )
})

describe("review round 1: no stale focus mark", () => {
  it("an already-focused target leaves no mark for the next focus", async () => {
    document.body.innerHTML = "<button>a</button>"
    const a = document.querySelector("button") as HTMLButtonElement
    const modality = tracker()
    a.focus()
    await focusSafely(a, { modality }, "layer")
    a.blur()
    a.focus()
    expect(modality.focusCause(a)).toBe("other")
  })

  it("a target that refuses focus leaves no mark", async () => {
    document.body.innerHTML = "<div>not focusable</div>"
    const d = document.querySelector("div") as HTMLDivElement
    const modality = tracker()
    await focusSafely(d, { modality }, "layer")
    d.tabIndex = -1
    d.focus()
    expect(modality.focusCause(d)).toBe("other")
  })
})
