// Model-based tests (add-marquee 5.2): measure, pause, hover and keyboard-focus edges over the
// default, autoFill, vertical, reverse and pauseOnHover={false} configurations, LTR and RTL, on a
// virtual clock (the first measurement waits for its frame). Reduced motion is the DOM tests'
// (it applies on mount, before the model's first step). jsdom has no layout: boxes are stubbed.
import { marqueeContract } from "@rind-ui/core"
import { Marquee, type MarqueeRootProps, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { afterEach, beforeEach, describe, it, vi } from "vitest"
import { domEnv, testMachine, virtualClock } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const jsdom = navigator.userAgent.includes("jsdom")
beforeEach(() => {
  if (!jsdom) return
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const w = this.getAttribute("data-part") === "viewport" ? 400 : 150
    return { width: w, height: 40, top: 0, left: 0, right: w, bottom: 40, x: 0, y: 0 } as DOMRect
  })
})
afterEach(() => vi.restoreAllMocks())

function variant(name: string, config: Partial<MarqueeRootProps>) {
  const clock = virtualClock()
  describe(`marquee model: ${name}`, () => {
    testMachine(marqueeContract, {
      test: it,
      setup: () =>
        render(
          <RindProvider environment={{ scheduler: clock.scheduler, reducedMotion: false }}>
            <Marquee.Root role="region" aria-label="Partners" {...config}>
              <Marquee.PauseTrigger />
              <Marquee.Viewport>
                <Marquee.Content>
                  <a href="#acme">Acme</a>
                  <a href="#globex">Globex</a>
                </Marquee.Content>
              </Marquee.Viewport>
            </Marquee.Root>
          </RindProvider>,
        ),
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
