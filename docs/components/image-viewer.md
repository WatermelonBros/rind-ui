# Image Viewer

An image you zoom and pan in place: a floor plan, a product photo, a scan. Ctrl-scroll and trackpad pinch (Safari's too), touch pinch and double click zoom about the pointer; drag moves the image; the keyboard and the buttons reach everything the pointer does. The image never leaves the view, a plain wheel keeps scrolling the page, and the zoom level is announced once after keyboard and button changes.

## When to use

- **Use it for** images whose detail matters: plans, diagrams, maps, product photos, documents.
- **Over a pan-and-zoom wrapper**:
  - keyboard zoom and pan with announcements, and buttons as the no-drag route (WCAG 2.5.7);
  - Safari's trackpad pinch;
  - clamped pinch with no overshoot at the limits;
  - bounds on every zoom, programmatic too;
  - page scroll kept until the user zooms.
- **Don't use it for** cropping ([Image Cropper](image-cropper.md)) or a plain image ([Image](image.md)). A lightbox is a [Dialog](dialog.md) holding a viewer.

```tsx
import { ImageViewer } from "@rind-ui/react"

<ImageViewer.Root maxZoom={4}>
  <ImageViewer.Viewport style={{ height: 320 }}>
    <ImageViewer.Image src="/plan.png" alt="Floor plan of the flat" />
  </ImageViewer.Viewport>
  <ImageViewer.ZoomOut />
  <ImageViewer.ZoomText />
  <ImageViewer.ZoomIn />
  <ImageViewer.Reset />
</ImageViewer.Root>
```

## API

<!-- api:image-viewer -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `ImageViewer.Root` | `root` | Holds the viewer; `--rind-image-zoom`, `--rind-image-offset-x` / `-y`. |
| `ImageViewer.Viewport` | `viewport` | Focusable `role="group"` ("image viewer"), named by the image's alt, with instructions; give it a size. |
| `ImageViewer.Image` | `image` | The image; its `alt` names the Viewport (the image itself is hidden). |
| `ImageViewer.ZoomIn`, `ZoomOut`, `Reset` | `zoom-in`, `zoom-out`, `reset` | Buttons; `aria-disabled` at the limits (they keep focus). Text children name them; empty or icon-only, `messages` does. |
| `ImageViewer.ZoomText` | `zoom-text` | "200%", `aria-hidden` (the change is announced). |

## Gestures

| Input | Effect |
|---|---|
| Ctrl + wheel, trackpad pinch, touch pinch | Zoom about the pointer |
| Wheel | Scrolls the page; zooms with `wheel="zoom"` |
| Drag | Moves the image when zoomed |
| Double click | Fit ↔ `doubleClickZoom` (2) about the pointer |

## Keyboard

| Key | Action |
|---|---|
| + or = | Zoom in about the centre |
| − | Zoom out |
| 0 | Back to fit |
| Arrows | Move the view by 10% (Shift: 50%) when the image is larger than the view on that axis; otherwise the page scrolls |

## Accessibility notes

- **One name, on the focusable group**: the image's alt; instructions as its description.
- **Announced once**: "Zoom 200%" after a quiet 500 ms of keyboard or button changes; pointer gestures are silent; never a live region.
- **No dragging-only action**: everything has a key and a button.
- **Buttons keep focus at the limits** (`aria-disabled`, not `disabled`).
- **The page keeps scrolling** at fit (plain wheel, `touch-action` lets the page pan and pinch).

## Testing

```tsx
import { getImageViewer } from "@rind-ui/testing"

const viewer = getImageViewer(screen, { name: "Floor plan of the flat" })
await viewer.via("keyboard").zoomIn()
expect(await viewer.zoom()).toBe(1.5)
await viewer.pan(2, 0)
expect(await viewer.canZoomOut()).toBe(true)
```

Contract actions: `settleLayout`, `zoomIn`, `zoomOut`, `reset`, `pan(dx, dy)`. Queries: `zoom`, `offset`, `canZoomIn`, `canZoomOut`.

## Tested with

<!-- tested-with:image-viewer -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
