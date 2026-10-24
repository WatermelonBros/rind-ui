// The Marquee contract model (React's matrix) against the Vue parts, and markup parity.
import { marqueeContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { afterEach, beforeEach, describe, it, vi } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Marquee, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const jsdom = navigator.userAgent.includes("jsdom")
// The pointer starts away from the marquee (a hover pause would skew the first state).
beforeEach(async () => {
  if (jsdom) return
  const { userEvent } = await import("vitest/browser")
  const park = document.createElement("div")
  park.style.cssText = "position:fixed;right:0;bottom:0;width:24px;height:24px;z-index:2147483647"
  document.body.append(park)
  await userEvent.hover(park, { force: true })
  park.remove()
})
// jsdom has no layout: a 400 px viewport and 150 px copies.
beforeEach(() => {
  if (!jsdom) return
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const w = this.getAttribute("data-part") === "viewport" ? 400 : 150
    return { width: w, height: 40, top: 0, left: 0, right: w, bottom: 40, x: 0, y: 0 } as DOMRect
  })
})
afterEach(() => vi.restoreAllMocks())

const marquee = (p: Record<string, unknown>) =>
  h(Marquee.Root, { role: "region", "aria-label": "Partners", ...p }, () => [
    h(Marquee.PauseTrigger),
    h(Marquee.Viewport, null, () =>
      h(Marquee.Content, null, () => [
        h("a", { href: "#acme" }, "Acme"),
        h("a", { href: "#globex" }, "Globex"),
      ]),
    ),
  ])
const reactMarquee = (p: Record<string, unknown>) =>
  r(
    R.Marquee.Root,
    { role: "region", "aria-label": "Partners", ...p } as never,
    r(R.Marquee.PauseTrigger),
    r(
      R.Marquee.Viewport,
      null,
      r(
        R.Marquee.Content,
        null,
        r("a", { href: "#acme" }, "Acme"),
        r("a", { href: "#globex" }, "Globex"),
      ),
    ),
  )

function variant(name: string, config: Record<string, unknown>) {
  const clock = virtualClock()
  describe(`vue marquee model: ${name}`, () => {
    testMachine(marqueeContract, {
      test: it,
      setup: () =>
        mount(() =>
          h(
            RindProvider,
            { environment: { scheduler: clock.scheduler, reducedMotion: false } },
            () => marquee(config),
          ),
        ),
      target: () => domEnv({ advanceClock: (ms) => clock.advance(ms) }),
      anchor: [{ name: "Partners" }],
      props: { pauseOnHover: config["pauseOnHover"] ?? true },
      modalities: jsdom ? ["keyboard", "virtual"] : ["pointer", "keyboard", "virtual"],
      clock,
      a11y,
    } as never)
  })
}
variant("default", {})
variant("autoFill", { autoFill: true })
variant("vertical", { orientation: "vertical" })
variant("reverse", { reverse: true })
variant("no hover pause", { pauseOnHover: false })

describe("Vue Marquee matches React", () => {
  it("default, paused, vertical, reverse", async () => {
    for (const p of [{}, { defaultPaused: true }, { orientation: "vertical", reverse: true }]) {
      await serverParity(reactMarquee(p), () => marquee(p))
      await clientParity(reactMarquee(p), () => marquee(p))
    }
  })
})
