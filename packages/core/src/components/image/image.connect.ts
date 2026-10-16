// Image's parts (design §2): one accessible name in every status, on the element that is
// there to carry it. While `loading`/`loaded` the <img> is named by its own `alt` (native:
// translation, <figure> association); in `idle`/`error` the <img> is `hidden` and Root takes
// the name (`role="img"`, `aria-label`). Fallbacks are never exposed. `alt=""` is decorative:
// nothing is exposed in any status. No inline styles.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { ImageStatus } from "../image-status/image-status.machine"

declare const process: { env: { NODE_ENV?: string } }

export interface ImageConnectState {
  readonly instance: string
  readonly status: ImageStatus
  /** Root's `alt`: `""` is decorative; `undefined` (untyped callers) is a development error. */
  readonly alt: string | undefined
}

/** `idle` and `error` have no image to show: Root carries the name, the <img> is hidden. */
const imageGone = (status: ImageStatus) => status === "idle" || status === "error"

export function imageConnect(state: ImageConnectState) {
  const { status, alt } = state
  const named = alt !== undefined && alt !== ""
  return {
    root: (): PartProps => ({
      ...scopeAttrs("image", "root", state.instance),
      role: named && imageGone(status) ? "img" : undefined,
      "aria-label": named && imageGone(status) ? alt : undefined,
      "data-decorative": dataFlag(alt === ""),
      "data-state": status,
    }),
    img: (): PartProps => ({
      ...scopeAttrs("image", "img", state.instance),
      // Missing at runtime: omitted, so automated checks report it (never a silent `alt=""`).
      alt,
      hidden: imageGone(status) ? true : undefined,
      "data-state": status,
    }),
    fallback: (): PartProps => ({
      ...scopeAttrs("image", "fallback", state.instance),
      "aria-hidden": "true",
      "data-state": status,
    }),
  }
}

/** Development: an Image without `alt` (only untyped callers can omit it). */
export function checkImageAltGiven(alt: unknown, instance: string): void {
  if (process.env.NODE_ENV === "production" || typeof alt === "string") return
  console.error(
    `[rind-ui] image "${instance}" has no alt: describe the image in Image.Root's alt, or pass alt="" when it is decorative`,
  )
}

/** Development: more than one Img in a Root. */
export function checkImgCount(count: number): void {
  if (process.env.NODE_ENV !== "production" && count > 1) {
    console.warn("[rind-ui] image: an Image.Root renders more than one Image.Img; render one")
  }
}
