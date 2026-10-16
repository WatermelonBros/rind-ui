// image-loading-status, DOM half: the status of a rendered <img>, read from the element
// itself when it registers (first commit, hydration, a source change), so a `load` that
// fired before handlers were attached is never missed (mui/base-ui#4468). No probe image.

export type ImageSettled = "loaded" | "error" | "loading"

/**
 * The element's status now: not `complete` → `loading`; `complete` with a natural width →
 * `loaded`; `complete` with no natural width (a broken image, or an SVG without intrinsic
 * size in some engines) → the result of `decode()`, which resolves for a usable image and
 * rejects for a broken one.
 */
export function imageSettled(img: HTMLImageElement): ImageSettled | Promise<"loaded" | "error"> {
  if (!img.complete) return "loading"
  if (img.naturalWidth > 0) return "loaded"
  // jsdom has no decode(): it never loads images, so the status stays `loading`.
  if (typeof img.decode !== "function") return "loading"
  return img.decode().then(
    () => "loaded",
    () => "error",
  )
}
