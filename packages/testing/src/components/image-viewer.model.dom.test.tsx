// Model-based tests (add-image-viewer 2.2): layout, zoom steps by buttons and keys and reset on
// a virtual clock (the announcement's quiet period); the invariant (never a live region) and
// axe after every step. Layout and image decoding need a browser.
import { imageViewerContract, imageViewerMessages } from "@rind-ui/core"
import { ImageViewer, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { domEnv, testMachine, virtualClock } from "../index"

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
describe.runIf(browser)("image-viewer model", () => {
  testMachine(imageViewerContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () =>
      render(
        <RindProvider environment={{ scheduler: clock.scheduler }}>
          <ImageViewer.Root>
            <ImageViewer.Viewport style={{ width: 400, height: 200 }}>
              <ImageViewer.Image src={testImage()} alt="Floor plan" />
            </ImageViewer.Viewport>
            <ImageViewer.ZoomOut />
            <ImageViewer.ZoomIn />
            <ImageViewer.Reset />
          </ImageViewer.Root>
        </RindProvider>,
      ),
    target: () => domEnv({ advanceClock: (ms) => clock.advance(ms), timeout: 200 }),
    anchor: [{ name: "Floor plan" }],
    props: { id: "oracle", messages: imageViewerMessages } as never,
    modalities: ["pointer", "keyboard", "virtual"],
    clock,
    a11y,
  } as never)
})
