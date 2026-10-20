// Image Viewer geometry (add-image-viewer design §1): the Image Cropper's placement with no
// rotation or flip, and one clamp that keeps the image inside the viewport.

import { type CropPlacement, imageBox, type Point, type Size } from "../image-cropper/geometry"

/** The viewer's placement: the cropper's, always unrotated and unflipped. */
export type ViewerPlacement = CropPlacement

export const NO_FLIP = { horizontal: false, vertical: false } as const

export function viewerPlacement(
  natural: Size,
  viewport: Size,
  zoom: number,
  offset: Point,
): ViewerPlacement {
  return { natural, viewport, zoom, rotation: 0, flip: NO_FLIP, offset }
}

/** The pan room on each axis: half of what the zoomed image overhangs the viewport (0 if it fits). */
export function panRoom(p: ViewerPlacement): Size {
  const box = imageBox(p.natural, p.viewport)
  return {
    width: Math.max(0, (box.width * p.zoom - p.viewport.width) / 2),
    height: Math.max(0, (box.height * p.zoom - p.viewport.height) / 2),
  }
}

/** An axis larger than the viewport covers it; an axis that fits stays centred. */
export function clampPan(p: ViewerPlacement): ViewerPlacement {
  const room = panRoom(p)
  const clamp = (v: number, r: number) => Math.min(r, Math.max(-r, v))
  return { ...p, offset: { x: clamp(p.offset.x, room.width), y: clamp(p.offset.y, room.height) } }
}
