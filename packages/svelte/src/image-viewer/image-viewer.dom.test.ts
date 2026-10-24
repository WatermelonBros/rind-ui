// The Image Viewer contract model (React's: layout, zoom steps by buttons and keys and reset on a
// virtual clock; layout and image decoding need a browser) against the Svelte parts, and DOM
// parity with React.
import { imageViewerContract, imageViewerMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Viewer from "../../fixtures/image-viewer/viewer.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const browser = !navigator.userAgent.includes("jsdom")

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function testImage(): string {
  const c = document.createElement("canvas")
  c.width = 800
  c.height = 400
  const ctx = c.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#336699"
  ctx.fillRect(0, 0, 800, 400)
  return c.toDataURL()
}

const clock = virtualClock()
describe.runIf(browser)("svelte image-viewer model", () => {
  testMachine(imageViewerContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () => mount(Viewer, { src: testImage(), scheduler: clock.scheduler } as never),
    target: () => domEnv({ advanceClock: (ms) => clock.advance(ms), timeout: 200 }),
    anchor: [{ name: "Floor plan" }],
    props: { id: "oracle", messages: imageViewerMessages } as never,
    modalities: ["pointer", "keyboard", "virtual"],
    clock,
    a11y,
  } as never)
})

const SRC = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
const react = (p: Record<string, unknown>) =>
  r(
    R.ImageViewer.Root,
    { id: "plan", ...p },
    r(R.ImageViewer.Viewport, null, r(R.ImageViewer.Image, { src: SRC, alt: "Floor plan" })),
    r(R.ImageViewer.ZoomOut, null, "−"),
    r(R.ImageViewer.ZoomText),
    r(R.ImageViewer.ZoomIn),
    r(R.ImageViewer.Reset),
  )

describe("Svelte ImageViewer matches React", () => {
  it("fitted, and zoomed in", async () => {
    for (const p of [{}, { defaultZoom: 2 }]) {
      await clientParity(react(p), Viewer, {
        root: { id: "plan", ...p },
        src: SRC,
        parity: true,
      } as never)
    }
  })
})
