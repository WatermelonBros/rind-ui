// The Image Cropper contract model (React's: layout, keyboard nudges and zoom steps on a
// virtual clock, free and fixed crop areas; layout and image decoding need a browser) against
// the Angular parts, and markup parity with React.
import { Component } from "@angular/core"
import { imageCropperContract, imageCropperMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { ImageCropper } from "./index"

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

/** The model fixture's clock and area. */
let model: { clock: ReturnType<typeof virtualClock>; fixed: boolean } = {
  clock: virtualClock(),
  fixed: false,
}

@Component({
  selector: "rind-f",
  imports: [RindProvider, ImageCropper],
  template: `<ng-container rindProvider [environment]="env">
    <div rindImageCropperRoot aria-label="Avatar" [fixedCropArea]="fixed" [defaultZoom]="2">
      <div rindImageCropperViewport style="width: 400px; height: 300px">
        <img rindImageCropperImage [src]="src" />
        <div rindImageCropperSelection></div>
      </div>
    </div>
  </ng-container>`,
})
class Model {
  readonly env = { scheduler: model.clock.scheduler }
  readonly fixed = model.fixed
  readonly src = testImage()
}

function variant(fixedCropArea: boolean) {
  const clock = virtualClock()
  describe.runIf(browser)(
    `angular image-cropper model: ${fixedCropArea ? "fixed area" : "free"}`,
    () => {
      testMachine(imageCropperContract, {
        test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
        setup: () => {
          model = { clock, fixed: fixedCropArea }
          return mount(Model)
        },
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
/** The configuration the next fixture renders. */
let current: { cropShape?: "circle"; fixedCropArea?: boolean; aspectRatio?: number } = {}

@Component({
  selector: "rind-f",
  imports: [ImageCropper],
  template: `<div
    rindImageCropperRoot
    id="avatar"
    aria-label="Avatar"
    [cropShape]="p.cropShape ?? 'rectangle'"
    [fixedCropArea]="p.fixedCropArea ?? false"
    [aspectRatio]="p.aspectRatio"
  >
    <div rindImageCropperViewport>
      <img rindImageCropperImage src="${SRC}" alt="" />
      <div rindImageCropperSelection>
        @for (position of positions; track position) {
          <div rindImageCropperHandle [position]="position"></div>
        }
        <div rindImageCropperGrid axis="horizontal"></div>
        <div rindImageCropperGrid axis="vertical"></div>
      </div>
    </div>
  </div>`,
})
class Fixture {
  readonly p = current
  readonly positions = POSITIONS
}

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

describe("Angular ImageCropper matches React", () => {
  for (const p of [
    {},
    { cropShape: "circle" },
    { fixedCropArea: true, aspectRatio: 1.5 },
  ] as (typeof current)[]) {
    it(`free, a circle, a fixed area ${JSON.stringify(p)}`, async () => {
      current = p
      await both(react(p), Fixture)
    })
  }
})
