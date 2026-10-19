// Image Cropper's strings: the crop area's name, role description, instructions and value.

import type { Rect } from "./geometry"

export interface ImageCropperMessages {
  readonly [key: string]: string | ((...args: never) => string)
  readonly label: string
  readonly roleDescription: string
  readonly instructions: string
  /** The crop in natural pixels, as text (the slider's value and the announcement). */
  readonly valueText: (rect: Rect, locale: string) => string
}

export const imageCropperMessages: ImageCropperMessages = {
  label: "Crop area",
  roleDescription: "crop area",
  instructions:
    "Arrow keys move the crop area; Shift or Control move it further. Alt with arrow keys resizes it. Plus and minus zoom.",
  valueText: (r, locale) => {
    const n = (v: number) => new Intl.NumberFormat(locale).format(Math.round(v))
    return `${n(r.width)} by ${n(r.height)} pixels, ${n(r.x)} from the left, ${n(r.y)} from the top`
  },
}
