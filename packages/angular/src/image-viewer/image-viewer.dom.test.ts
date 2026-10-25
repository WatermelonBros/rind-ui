// The Image Viewer contract model (React's: layout, zoom steps by buttons and keys and reset on
// a virtual clock; layout and image decoding need a browser) against the Angular parts, and
// markup parity with React.
import { Component } from "@angular/core"
import { imageViewerContract, imageViewerMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { ImageViewer } from "./index"

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

@Component({
  selector: "rind-f",
  imports: [RindProvider, ImageViewer],
  template: `<ng-container rindProvider [environment]="env">
    <div rindImageViewerRoot>
      <div rindImageViewerViewport style="width: 400px; height: 200px">
        <img rindImageViewerImage [src]="src" alt="Floor plan" />
      </div>
      <button rindImageViewerZoomOut></button>
      <button rindImageViewerZoomIn></button>
      <button rindImageViewerReset></button>
    </div>
  </ng-container>`,
})
class Model {
  readonly env = { scheduler: clock.scheduler }
  readonly src = testImage()
}

describe.runIf(browser)("angular image-viewer model", () => {
  testMachine(imageViewerContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () => mount(Model),
    target: () => domEnv({ advanceClock: (ms) => clock.advance(ms), timeout: 200 }),
    anchor: [{ name: "Floor plan" }],
    props: { id: "oracle", messages: imageViewerMessages } as never,
    modalities: ["pointer", "keyboard", "virtual"],
    clock,
    a11y,
  } as never)
})

const SRC = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
/** The configuration the next fixture renders. */
let current: { defaultZoom?: number } = {}

@Component({
  selector: "rind-f",
  imports: [ImageViewer],
  template: `<div rindImageViewerRoot id="plan" [defaultZoom]="p.defaultZoom">
    <div rindImageViewerViewport><img rindImageViewerImage src="${SRC}" alt="Floor plan" /></div>
    <button rindImageViewerZoomOut>−</button>
    <span rindImageViewerZoomText></span>
    <button rindImageViewerZoomIn></button>
    <button rindImageViewerReset></button>
  </div>`,
})
class Fixture {
  readonly p = current
}

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

describe("Angular ImageViewer matches React", () => {
  for (const p of [{}, { defaultZoom: 2 }]) {
    it(`fitted, and zoomed in ${JSON.stringify(p)}`, async () => {
      current = p
      await both(react(p), Fixture)
    })
  }
})
