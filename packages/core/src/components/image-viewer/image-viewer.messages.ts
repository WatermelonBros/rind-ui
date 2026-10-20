// Image Viewer's strings: the viewport's role description and instructions, the buttons'
// names, and the zoom level (shown, and announced after keyboard and button changes).

export interface ImageViewerMessages {
  readonly [key: string]: string | ((...args: never) => string)
  readonly roleDescription: string
  readonly instructions: string
  readonly zoomIn: string
  readonly zoomOut: string
  readonly reset: string
  /** "200%". */
  readonly zoomText: (zoom: number, locale: string) => string
  /** Announced: "Zoom 200%". */
  readonly zoomAnnouncement: (zoom: number, locale: string) => string
}

const percent = (zoom: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(zoom)

export const imageViewerMessages: ImageViewerMessages = {
  roleDescription: "image viewer",
  instructions: "Plus and minus zoom, arrow keys move the image, 0 resets.",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  reset: "Reset zoom",
  zoomText: percent,
  zoomAnnouncement: (zoom, locale) => `Zoom ${percent(zoom, locale)}`,
}
