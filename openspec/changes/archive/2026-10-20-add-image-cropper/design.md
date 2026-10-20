## Context

See [image-cropper.md](../../../docs/research/image-cropper.md), in particular the detailed
reading of Zag / Ark, whose capabilities this change matches.

## Decisions

### 1. Geometry (`geometry.ts`, pure)

- `Viewport { width, height }`, `Natural { width, height }`, `Crop` (viewport px).
- The image box is the natural image fitted ("contain") in the viewport at zoom 1, centred.
- `imageMatrix({ natural, viewport, zoom, rotation, flip, offset })`: the natural →
  viewport affine matrix. It scales the natural image to the box, then applies zoom, flip
  and rotation about the box centre, then translates by `offset`.
- `invert(m)`, `apply(m, point)`.
- `cropSource(m, crop)` returns `{ corners: [tl, tr, br, bl], rect }` in natural px.
- `covers(m, crop, natural)`: every corner maps inside `[0, W] × [0, H]`, within 0.5 px.
- `clampOffset(...)`: the nearest offset that covers. When zoom or rotation cannot cover,
  zoom is raised to the smallest value that does (`minCoverZoom`). Found by bisection on
  the coverage test, which stays exact for any angle.
- `defaultCrop(viewport, aspect, imageBox)`: the largest centred rectangle with the
  aspect ratio, inside the image box at 80 % of it.
- `moveCrop`: clamped so that the crop stays inside the viewport and covered.
- `resizeCrop(crop, handle, dx, dy, { aspect, min, max, viewport, lockRatio })`: the
  opposite edges stay fixed, and the result is clamped to coverage.

### 2. Props

- `crop`, `defaultCrop`, `onCropChange(crop, details)`. `details` carries `data`: the
  natural-pixel `{ rect, corners }`.
- `zoom`, `defaultZoom` (1), `onZoomChange`; `minZoom` (1), `maxZoom` (5); `zoomStep`
  (0.1 per wheel notch and per +/−); `zoomSensitivity` (2, pinch).
- `rotation`, `defaultRotation` (0, free degrees), `onRotationChange`.
- `flip`, `defaultFlip`, `onFlipChange`.
- `aspectRatio?`; `cropShape` (`rectangle`, or `circle`, which implies aspect 1).
- `minWidth` / `minHeight` (40, viewport px); `maxWidth` / `maxHeight` (∞).
- `fixedCropArea`.
- `nudgeStep` (1), `nudgeStepShift` (10), `nudgeStepCtrl` (50).
- `messages`.

### 3. Machine

States:
- `idle`;
- `dragging`: moving the selection or resizing it from a handle, with Shift locking the
  ratio;
- `panning`;
- `settling`: a keyboard change waits 500 ms before it is announced. A new keyboard change
  re-enters it.

Context: `natural`, `viewport`, `offset`, `drag` (the start point, the crop and offset at
the start, the handle), and `pinch` (the start distance and zoom).

Events:
- `IMAGE.LOADED`, `VIEWPORT.MEASURED`;
- `KEY.NUDGE { dx, dy, resize }`;
- `ZOOM.STEP { direction, at? }`, `ZOOM.SET`;
- `ROTATE.SET`, `FLIP.SET`;
- `DRAG.START { target: "selection" | Handle | "image", x, y, lockRatio }`, `DRAG.MOVE`,
  `DRAG.END`;
- `PINCH.START { distance }`, `PINCH.MOVE`, `PINCH.END`;
- `RESET`;
- `SYNCED` (onProps).

Every change keeps the image covering the crop (§1). In `fixedCropArea`, the crop is the
default crop and stays put: selection drags and arrows pan instead.

### 4. Connect

Parts `root`, `viewport`, `image`, `selection`, `handle`, `grid`.
- Root: a group, named by the consumer (no live region). It sets the CSS variables
  `--rind-crop-x`, `-y`, `-width` and `-height`, `--rind-image-zoom`,
  `--rind-image-rotation` and `--rind-image-offset-x` / `-y`.
- Viewport: `touch-action: none`.
- Image: `aria-hidden`, `alt=""`, `draggable="false"`, with inline `transform` = the CSS
  matrix.
- Selection: `role="slider"`, `tabindex="0"`, with `aria-roledescription` from messages,
  `aria-label`, `aria-valuetext` (the natural-pixel rectangle), `aria-valuenow` (natural
  x) and `aria-valuemin` / `aria-valuemax`. `aria-describedby` points to visually hidden
  instructions. `data-dragging`, `data-panning`, `data-shape`.
- Handle `[data-position]` (eight positions): `aria-hidden`, with a 24 px hit area.
- Grid `[data-axis]`: `aria-hidden`.

### 5. Keyboard (on the selection)

- Arrows nudge (pan in `fixedCropArea`), by `nudgeStep`, or the Shift and Ctrl/Cmd steps.
- Alt+arrows resize the end edges.
- `+` / `=` and `-` zoom by `zoomStep` around the crop centre.

Modifiers are read from each event.

### 6. Output

`cropImage(image, data, { output: "blob" | "dataUrl", type?, quality?, maxSize? })` draws
with the same matrix and returns the result. It rejects with
`CropError("not-loaded" | "tainted" | "too-large")`.

### 7. Contract

Located by the Root's role and name. Actions:
- `nudge(dx, dy)`, `resize(dx, dy)`: keys;
- `zoomIn`, `zoomOut`: keys;
- `dragSelection(dx, dy)`, `dragHandle(position, dx, dy)`: pointer.

Queries: `crop` (natural rect, from `data-*`), `zoom`, `valueText`, `covered`.

### 8. Theme

`image-cropper.css`, family `decoration`:
- the outside of the crop is dimmed with a box-shadow tinted with `color-mix` of a role
  token;
- the selection has a light border and a thirds grid;
- the handles are 12 px with 24 px hit areas;
- `data-shape="circle"`;
- forced colours;
- logical properties.
