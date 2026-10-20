## Why

Zoomable product photos, diagrams, scans and maps all need the same thing: zoom and pan by
wheel, trackpad pinch, touch pinch, drag and double click, with a keyboard and button route
of the same reach and a zoom level a screen reader hears. The libraries that do this skip the
keyboard and roles (react-zoom-pan-pinch), miss Safari's trackpad pinch (Viewer.js #492),
overshoot at the limits (yet-another-react-lightbox #380), or ignore the bounds on
programmatic zoom (PhotoSwipe #2187).

Research: [image-viewer](../../../docs/research/image-viewer.md)

Depends on: `add-image-cropper` (geometry), `add-a11y-foundations` (announcer),
`add-theme-system`.

## What Changes

- A public **Image Viewer** in `@rind-ui/core` (machine, connect, contract, messages, meta;
  `core/dom/zoom-gestures.ts`) and `@rind-ui/react`. Parts: `Root`, `Viewport`, `Image`,
  `ZoomIn`, `ZoomOut`, `Reset`, `ZoomText`.
- Controllable `zoom` (1 = fit) with `minZoom`, `maxZoom` and `step`. Every change is
  clamped so the image never leaves the viewport.
- Gestures:
  - drag pans;
  - ctrl-wheel, trackpad pinch (including Safari's `gesture*` events) and touch pinch zoom
    about the pointer;
  - double click toggles between fit and `doubleClickZoom`;
  - a plain wheel scrolls the page unless `wheel="zoom"`.
- Keys on the focusable viewport: `+` and `-` zoom, `0` resets, and the arrows pan when
  zoomed.
- The zoom level is announced after keyboard and button changes.
- `getImageViewer` driver, theme stylesheet, site examples, docs page.

## Impact

- New capability `image-viewer`.
