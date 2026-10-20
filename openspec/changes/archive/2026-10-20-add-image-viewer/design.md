## Context

See [image-viewer.md](../../../docs/research/image-viewer.md).

## Decisions

### 1. Geometry

The Image Cropper's `imageBox`, `zoomAt` and `CropPlacement` are reused, with rotation 0 and
no flip. A new `clampPan(p)` keeps the image inside the viewport on each axis:
- when the scaled image is larger than the viewport, it covers it, with
  `|offset| ≤ (scaled − viewport) / 2`;
- otherwise the offset is 0 (centred).

### 2. Machine (`image-viewer.machine.ts`)

States:
- `loading`, until the image and the viewport have a size;
- `idle`;
- `panning`, during a drag;
- `settling`, after a key or button change, which announces "Zoom 200%" after a quiet 500 ms
  and restarts the delay on each new change.

Values and context:
- controllable `zoom`, clamped to `[minZoom, maxZoom]`, default `[1, 4]`;
- context: `natural`, `viewport`, `offset`, `drag` and `pinch`.

Events:
- `IMAGE.LOADED`, `VIEWPORT.MEASURED`;
- `ZOOM.STEP { direction, at?, source: "key" | "button" | "wheel" }`;
- `ZOOM.TO { zoom, at? }`, for the wheel and pinch factors;
- `TOGGLE { at }`, the double click;
- `PAN.KEY { dx, dy }`;
- `DRAG.START`, `DRAG.MOVE`, `DRAG.END`;
- `PINCH.START`, `PINCH.MOVE`, `PINCH.END`;
- `RESET`, `SYNCED`.

Every change goes through `commit`, which clamps the zoom, then `zoomAt`, then `clampPan`.
Pinch steps are clamped each time, so they never overshoot (yet-another-react-lightbox
#380).

### 3. Gestures (`core/dom/zoom-gestures.ts`)

- Pointer:
  - one pointer drags (`DRAG.*`), only when zoomed past fit;
  - two touch pointers pinch.
- `wheel`:
  - `ctrlKey`, which is a trackpad pinch in Chromium and Firefox, zooms by
    `exp(-deltaY / 100)` about the pointer, with `preventDefault`;
  - a plain wheel zooms only with `wheel="zoom"`, else it is left to the page;
  - it also works during a drag (react-zoom-pan-pinch #543).
- Safari `gesturestart` / `gesturechange`: zoom by `scale` about the pointer, with
  `preventDefault` (Viewer.js #492).
- `dblclick` toggles about the pointer.
- A ResizeObserver reports `VIEWPORT.MEASURED` (Viewer.js #663).

### 4. Connect

- Root: `data-state`, `data-zoomed` and `data-panning`. It also sets the variables
  `--rind-image-zoom` and `--rind-image-offset-x` / `-y`.
- Viewport:
  - `role="group"`, `aria-roledescription` from `messages.roleDescription` ("image
    viewer");
  - named by the image's alt (`aria-label`);
  - `aria-describedby` points to visually hidden instructions;
  - `tabindex="0"`;
  - structural inline styles: `overflow: hidden`, `position: relative`, `touch-action: none`
    when zoomed, else `pan-y pinch-zoom`, so the page still scrolls at fit.
- Image: `alt=""` with `aria-hidden` (the name is on the Viewport), the transform inline,
  `draggable="false"`.
- ZoomIn and ZoomOut are buttons with `aria-disabled` at the limits; Reset has it at fit.
  `aria-disabled`, not `disabled`, so the focus is not dropped when a press reaches the limit.
  Their names come from `messages`.
- ZoomText shows "200%" for sighted users and is `aria-hidden`, because the announcement
  carries it.

### 5. Keys (React part, on the Viewport)

- `+`, `=`: zoom in about the centre; `-`, `_`: zoom out; `0`: reset.
- Arrows pan by 10% of the viewport and Shift+arrows by 50%, only when the image is larger
  than the viewport on that axis. Otherwise the key is not handled, so the page scrolls.

### 6. Contract

Located by the Viewport's name. Actions:
- `zoomIn` and `zoomOut`, through the keys or buttons depending on the modality;
- `reset`;
- `pan(dx, dy)`: arrow presses, or a drag of the image the other way.

Wheel and pinch are not contract actions; the DOM tests dispatch them.

Queries: `zoom` (from `data-zoom`), `offset`, `canZoomIn`, `canZoomOut`.

### 7. Theme

`image-viewer.css`, family `decoration`:
- the viewport surface with a radius and a `grab` / `grabbing` cursor when zoomed;
- the controls as a small floating toolbar;
- a focus ring;
- forced colours.
