import { describe, expect, it } from "vitest"
import { type ImageViewerConnectInput, imageViewerConnect } from "./image-viewer.connect"
import { imageViewerContract } from "./image-viewer.contract"
import { viewerPlacement } from "./image-viewer.geometry"
import { imageViewerMachine } from "./image-viewer.machine"
import { imageViewerMessages } from "./image-viewer.messages"
import { imageViewerMeta } from "./image-viewer.meta"

const input = (
  zoom = 2,
  state: ImageViewerConnectInput["state"] = "idle",
): ImageViewerConnectInput => ({
  instance: "v",
  state,
  placement: viewerPlacement({ width: 800, height: 400 }, { width: 400, height: 200 }, zoom, {
    x: zoom === 1 ? 0 : 10,
    y: 0,
  }),
  minZoom: 1,
  maxZoom: 4,
  label: "Floor plan",
  ids: { instructions: "v-ins" },
  messages: imageViewerMessages,
  locale: "en",
})

describe("image viewer connect", () => {
  it("a focusable named group with instructions; the image is hidden", () => {
    const a = imageViewerConnect(input())
    expect(a.viewport({ focused: false, modality: "pointer" })).toMatchObject({
      role: "group",
      tabindex: 0,
      "aria-roledescription": "image viewer",
      "aria-label": "Floor plan",
      "aria-describedby": "v-ins",
      "data-zoom": "2",
      "data-zoomed": "",
    })
    expect(a.image()).toMatchObject({ alt: "", "aria-hidden": "true" })
    expect(a.zoomText).toBe("200%")
  })

  it("buttons disabled at the limits", () => {
    expect(imageViewerConnect(input(4)).zoomIn()["aria-disabled"]).toBe("true")
    expect(imageViewerConnect(input(1)).zoomOut()["aria-disabled"]).toBe("true")
    expect(imageViewerConnect(input(2)).zoomOut()["aria-disabled"]).toBeUndefined()
  })

  it("at fit the page keeps its scroll and pinch", () => {
    const style = imageViewerConnect(input(1)).viewport({ focused: false, modality: "pointer" })[
      "style"
    ] as Record<string, string>
    expect(style["touchAction"]).toBe("pan-x pan-y pinch-zoom")
  })
})

describe("image viewer meta matches the code", () => {
  it("contract, states and data attributes", () => {
    expect(imageViewerMeta.contract.queries).toEqual(Object.keys(imageViewerContract.queries))
    expect(Object.keys(imageViewerMeta.states)).toEqual(Object.keys(imageViewerMachine.def.states))
    const actions = Object.fromEntries(
      Object.entries(imageViewerContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(imageViewerMeta.contract.actions).toEqual(actions)
    const a = imageViewerConnect(input(4, "panning"))
    const parts = {
      root: a.root(),
      viewport: a.viewport({ focused: true, modality: "keyboard" }),
      image: a.image(),
      "zoom-in": a.zoomIn(),
      "zoom-out": imageViewerConnect(input(1)).zoomOut(),
      reset: imageViewerConnect(input(1)).reset(),
      "zoom-text": a.zoomTextPart(),
    }
    for (const [name, props] of Object.entries(parts)) {
      const keys = Object.keys(props)
        .filter((k) => k.startsWith("data-") && props[k] !== undefined)
        .sort()
      const meta =
        imageViewerMeta.dataAttributes[name as keyof typeof imageViewerMeta.dataAttributes]
      expect(Object.keys(meta).sort(), name).toEqual(keys)
    }
  })
})
