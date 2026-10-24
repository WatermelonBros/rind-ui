// The Marquee contract model (React's matrix) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import { type MarqueeOrientation, marqueeContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { afterEach, beforeEach, describe, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Marquee } from "./marquee"

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

interface P {
  readonly autoFill?: boolean
  readonly orientation?: MarqueeOrientation
  readonly reverse?: boolean
  readonly pauseOnHover?: boolean
  readonly defaultPaused?: boolean
}
/** The configuration and environment the next fixture renders. */
let current: { p: P; environment?: unknown } = { p: {} }

const MARQUEE = `<div
      rindMarqueeRoot
      role="region"
      aria-label="Partners"
      [autoFill]="p.autoFill ?? false"
      [orientation]="p.orientation ?? 'horizontal'"
      [reverse]="p.reverse ?? false"
      [pauseOnHover]="p.pauseOnHover ?? true"
      [defaultPaused]="p.defaultPaused"
    >
      <button rindMarqueePauseTrigger></button>
      <div rindMarqueeViewport>
        <div *rindMarqueeContent><a href="#acme">Acme</a><a href="#globex">Globex</a></div>
      </div>
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Marquee],
  template: `@if (environment) {
      <ng-container rindProvider [environment]="$any(environment)">${MARQUEE}</ng-container>
    } @else {
      ${MARQUEE}
    }`,
})
class Tree {
  readonly p = current.p
  readonly environment = current.environment
}
const reactMarquee = (p: P) =>
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

function variant(name: string, config: P) {
  const clock = virtualClock()
  describe(`angular marquee model: ${name}`, () => {
    testMachine(marqueeContract, {
      test: it,
      setup: () => {
        current = { p: config, environment: { scheduler: clock.scheduler, reducedMotion: false } }
        return mount(Tree)
      },
      target: () => domEnv({ advanceClock: (ms) => clock.advance(ms) }),
      anchor: [{ name: "Partners" }],
      props: { pauseOnHover: config.pauseOnHover ?? true },
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

describe("Angular Marquee matches React", () => {
  it("default, paused, vertical, reverse", async () => {
    for (const p of [
      {},
      { defaultPaused: true },
      { orientation: "vertical", reverse: true },
    ] as P[]) {
      current = { p }
      await both(reactMarquee(p), Tree)
    }
  })
})
