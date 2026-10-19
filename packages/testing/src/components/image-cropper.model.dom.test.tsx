// Model-based tests (add-image-cropper 3.1): layout, keyboard nudges and zoom steps on a
// virtual clock (the announcement's quiet period), free and fixed crop areas; the
// invariants (the image covers the crop, never a live root) and axe after every step.
// Layout and image decoding need a browser.
import { imageCropperContract, imageCropperMessages } from "@rind-ui/core"
import { ImageCropper, RindProvider } from "@rind-ui/react"
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
  c.width = 400
  c.height = 300
  const ctx = c.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#336699"
  ctx.fillRect(0, 0, 400, 300)
  return c.toDataURL()
}

function variant(fixedCropArea: boolean) {
  const clock = virtualClock()
  describe.runIf(browser)(`image-cropper model: ${fixedCropArea ? "fixed area" : "free"}`, () => {
    testMachine(imageCropperContract, {
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () =>
        render(
          <RindProvider environment={{ scheduler: clock.scheduler }}>
            <ImageCropper.Root aria-label="Avatar" fixedCropArea={fixedCropArea} defaultZoom={2}>
              <ImageCropper.Viewport style={{ width: 400, height: 300 }}>
                <ImageCropper.Image src={testImage()} />
                <ImageCropper.Selection />
              </ImageCropper.Viewport>
            </ImageCropper.Root>
          </RindProvider>,
        ),
      target: () => domEnv({ advanceClock: (ms) => clock.advance(ms), timeout: 200 }),
      anchor: [{ name: "Avatar" }],
      props: {
        id: "oracle",
        messages: imageCropperMessages,
        fixedCropArea,
        defaultZoom: 2,
      } as never,
      modalities: ["keyboard"],
      clock,
      a11y,
    } as never)
  })
}

variant(false)
variant(true)
