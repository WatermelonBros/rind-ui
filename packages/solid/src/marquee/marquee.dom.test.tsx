/** @jsxImportSource solid-js */
// The Marquee contract model (React's matrix) against the Solid parts, and markup parity.
import { marqueeContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { afterEach, beforeEach, describe, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Marquee, type MarqueeRootProps, RindProvider } from "../index"

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

const marquee = (p: Record<string, unknown>): JSX.Element => (
  <Marquee.Root role="region" aria-label="Partners" {...(p as MarqueeRootProps)}>
    <Marquee.PauseTrigger />
    <Marquee.Viewport>
      <Marquee.Content>
        <a href="#acme">Acme</a>
        <a href="#globex">Globex</a>
      </Marquee.Content>
    </Marquee.Viewport>
  </Marquee.Root>
)
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
  describe(`solid marquee model: ${name}`, () => {
    testMachine(marqueeContract, {
      test: it,
      setup: () =>
        mount(() => (
          <RindProvider environment={{ scheduler: clock.scheduler, reducedMotion: false }}>
            {marquee(config)}
          </RindProvider>
        )),
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

describe("Solid Marquee matches React", () => {
  it("default, paused, vertical, reverse", async () => {
    for (const p of [{}, { defaultPaused: true }, { orientation: "vertical", reverse: true }]) {
      await clientParity(reactMarquee(p), () => marquee(p))
    }
  })
})
