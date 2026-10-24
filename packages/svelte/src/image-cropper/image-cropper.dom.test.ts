// The Image Cropper contract model (React's: layout, keyboard nudges and zoom steps on a virtual
// clock, free and fixed crop areas; layout and image decoding need a browser) against the Svelte
// parts, and DOM parity with React.
import { imageCropperContract, imageCropperMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Cropper from "../../fixtures/image-cropper/cropper.svelte"
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
  c.width = 400
  c.height = 300
  const ctx = c.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#336699"
  ctx.fillRect(0, 0, 400, 300)
  return c.toDataURL()
}

function variant(fixedCropArea: boolean) {
  const clock = virtualClock()
  describe.runIf(browser)(
    `svelte image-cropper model: ${fixedCropArea ? "fixed area" : "free"}`,
    () => {
      testMachine(imageCropperContract, {
        test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
        setup: () =>
          mount(Cropper, {
            src: testImage(),
            scheduler: clock.scheduler,
            root: { fixedCropArea, defaultZoom: 2 },
          } as never),
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
    },
  )
}

variant(false)
variant(true)

const SRC = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
const POSITIONS = ["n", "e", "s", "w"] as const
const react = (p: Record<string, unknown>) =>
  r(
    R.ImageCropper.Root,
    { id: "avatar", "aria-label": "Avatar", ...p },
    r(
      R.ImageCropper.Viewport,
      null,
      r(R.ImageCropper.Image, { src: SRC, alt: "" }),
      r(
        R.ImageCropper.Selection,
        null,
        ...POSITIONS.map((position) => r(R.ImageCropper.Handle, { key: position, position })),
        r(R.ImageCropper.Grid, { axis: "horizontal" }),
        r(R.ImageCropper.Grid, { axis: "vertical" }),
      ),
    ),
  )

describe("Svelte ImageCropper matches React", () => {
  it("free, a circle, a fixed area", async () => {
    for (const p of [{}, { cropShape: "circle" }, { fixedCropArea: true, aspectRatio: 1.5 }]) {
      await clientParity(react(p), Cropper, {
        root: { id: "avatar", ...p },
        src: SRC,
        parity: true,
      } as never)
    }
  })
})
