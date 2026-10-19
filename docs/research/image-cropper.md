# Image Cropper — research

Select the part of an image to keep (an avatar, a cover, a product photo): a crop area over
the image that the user moves and resizes, optionally with zoom, rotation and flipping, and an
output in the image's own pixels. The hard parts are the geometry (the crop must stay valid
under zoom, rotation, flip, aspect ratio and bounds, and map back to the right pixels), and
making a two-dimensional, pointer-first gesture usable by keyboard and screen reader.

One of the nine libraries ships it: Zag / Ark (`image-cropper`). The rest of the field is
single-purpose libraries: react-image-crop, react-easy-crop, Cropper.js.

Sources read (October 2026): Zag `packages/machines/image-cropper/src`
(`image-cropper.connect.ts`, `image-cropper.machine.ts`), the issue trackers of Zag and Ark,
react-image-crop (`dominictobias/react-image-crop`), react-easy-crop
(`ValentinH/react-easy-crop`) and Cropper.js v2 (`fengyuanchen/cropperjs`), and their
accessibility issues.

## Pattern

There is no APG pattern for a two-dimensional selection. What exists:
- **Slider** is one-dimensional. Zag still uses `role="slider"` with
  `aria-roledescription="2d slider"`, `aria-valuenow` = x, and the full rectangle in
  `aria-valuetext`. That gives screen readers a known control, though half its value is
  unspoken.
- **A single focusable crop area with instructions** (arrows move, a modifier resizes) keeps
  one tab stop. One focusable handle per corner multiplies tab stops by eight
  (react-image-crop).
- **Announcing the result** of a keyboard change is required: the visual change is
  otherwise silent (react-image-crop #537, react-easy-crop #586).
- Zoom and rotation are ordinary controls (a slider, buttons), outside the crop area.

## How the others built it

### Zag / Ark (`image-cropper`)

Read in detail (machine, `utils/transform.ts`, `utils/crop.ts`) and against Ark's docs.

- **Model**: the crop is a rectangle in *viewport* coordinates; the image moves under it
  through an affine transform built from `zoom`, `rotation` (free, 0–360°), `flip` and a
  pan `offset`. The natural → viewport matrix is that transform scaled from the displayed
  image box to natural pixels and centred; its inverse maps the crop's four corners back
  to the source image (`getCropData().corners`, a quad under rotation) and their bounding
  rect. Export draws the whole image with the same matrix (`ctx.setTransform`) into a
  canvas the size of the crop, so preview and output cannot diverge.
- **Props** (Ark): `aspectRatio`, `cropShape` (`rectangle` / `circle`), `initialCrop`,
  `minWidth` / `minHeight` (40), `maxWidth` / `maxHeight` (∞), `zoom` / `defaultZoom` (1),
  `minZoom` (1) / `maxZoom` (5), `zoomStep` (0.1 per wheel step), `zoomSensitivity`
  (pinch, 2), `rotation` / `defaultRotation`, `flip` / `defaultFlip`, `fixedCropArea`,
  `nudgeStep` (1), `nudgeStepShift` (10), `nudgeStepCtrl` (50), `translations`;
  `onCropChange`, `onZoomChange`, `onRotationChange`, `onFlipChange`.
- **API**: `setZoom`, `zoomBy`, `setRotation`, `rotateBy`, `setFlip`, `flipHorizontally`,
  `flipVertically`, `resize(handle, delta)`, `setCrop`, `reset`,
  `getCroppedImage({ output: "blob" | "dataUrl" })`, `getCropData()`.
- **Interaction**: drag the selection to move it, a handle to resize (Shift locks the
  current ratio), drag outside the selection to pan the image, wheel zoom around the
  pointer, two-finger pinch; with `fixedCropArea` the crop stays put and every drag pans.
  Keyboard on the selection: arrows nudge (Shift ×10, Ctrl/Cmd ×50), Alt+arrows resize,
  +/− zoom; with `fixedCropArea` arrows pan.
- **Parts**: root (`group`, roledescription "Image cropper", **`aria-live="polite"` on the
  whole root** with a description of the preview), viewport, image (`aria-hidden`),
  selection (`slider` / "2d slider", focusable, value text with the rectangle,
  instructions in `aria-description`), 8 handles (`aria-hidden`), grid (`axis`).
  CSS variables `--crop-x/y/width/height`, `--image-zoom`, `--image-rotation`,
  `--image-offset-x/y`.
- **Pan clamp**: `clampOffset` keeps the rotated image's *axis-aligned bounding box*
  around the viewport (or the crop with `fixedCropArea`). Under free rotation the AABB
  covering the crop does not mean the image covers it: the crop's corners can fall in the
  empty triangles outside the rotated image, and the export then has transparent corners.
- **Bugs**: #3238 (closed) the cropped image was the wrong region when flipped or rotated;
  #3150 (closed) cropping wrong; #3264 (closed) with `fixedCropArea` nothing was focusable;
  Ark #3901 (closed) images without CORS could not be cropped (tainted canvas); Ark #4124
  (closed, Vue) root props ignored.

### react-image-crop

- Controlled `crop` (px or %), `aspect`, `minWidth` / `minHeight`, `keepSelection`,
  `circularCrop`, `ruleOfThirds`.
- The selection is focusable and moves with arrows (Shift / Cmd for bigger steps). Each
  drag handle is focusable and resizes with arrows, with `aria-label`s.
- Bugs: #403 (closed) resizing was not possible by keyboard, and the handle read "blank";
  #537 (open) no announcement when the area moves or resizes; #561 (open) Safari cannot
  reach the handles by Tab (macOS Safari skips non-text controls); #503 (closed) Cmd+arrow
  left a key "stuck" (a stale keys-down set), blocking every page shortcut.

### react-easy-crop

- The crop area is fixed in the middle; the user pans and zooms the image under it
  (`crop` = image offset, `zoom`, `rotation`, `aspect`, `cropShape`, `objectFit`);
  `onCropComplete(area, areaPixels)`.
- Keyboard support arrived late: #569 / #574 (closed) arrows move the image; #585 (closed)
  focus the cropper on click; #586 (closed) emit the result when the keyboard interaction
  ends (not on every key).
- #91 (closed) black crops on mobile Safari for very large images (canvas size limits).

### Cropper.js v2

- Web components (`cropper-canvas`, `cropper-image`, `cropper-selection`,
  `cropper-handle`); keyboard on the selection; multiple selections.

### Not shipped

Radix, React Aria, Base UI, Headless UI, Ariakit, Kobalte, Reka, Melt.

## Accessibility

- **One tab stop** for the crop area. Arrows move it; Shift+arrows move by a larger step;
  Alt (Option)+arrows resize from the end edges (width, height); Shift+Alt for bigger
  resize steps. Zoom (+ / −) when zoom is enabled. Home / End are not used.
- **Name, description and value**: named "Crop area", described by the keyboard
  instructions, its rectangle in text ("Crop 320 by 240 pixels, 40 from the left, 60 from
  the top") as `aria-valuetext` on a slider role with roledescription "crop area" (a known,
  focusable role; the description carries the second dimension).
- **Announce the result after a keyboard change**, debounced (a burst of arrow presses
  announces once), politely; never the whole root as a live region (Zag's root is live and
  re-reads its description).
- **Handles are pointer affordances** (`aria-hidden`), at least 24 × 24 px hit areas.
- **Zoom and rotate controls** are the consumer's buttons and sliders bound to the API
  (`zoomIn`, `rotate`), each with its own name.
- **Reduced motion**: no animated transitions of the crop.
- **macOS Safari Tab**: the crop area must be focusable by Tab (`tabindex="0"` on a
  non-button element is reachable; buttons are not unless the user enabled it) —
  react-image-crop #561 is that trap.

## Bug history

- Zag #3238, #3150: the output region was wrong under flip and rotation.
- Zag #3264: a fixed crop area removed the only focusable element.
- Ark #3901: images without CORS taint the canvas; the output fails.
- react-image-crop #403, #537, #561, #503: keyboard resize missing, no announcements,
  Safari Tab, stuck modifier keys.
- react-easy-crop #586: results emitted on every key; #585 focus on click; #91 canvas size
  limits on iOS.

## Known pitfalls

- One matrix for preview and export: the CSS transform of the image and the canvas
  `setTransform` of the output come from the same function, or flip and rotation drift
  apart (Zag #3238).
- Under free rotation, an axis-aligned bounding box covering the crop is not coverage:
  check the crop's corners through the inverse matrix.
- Aspect ratio and minimum size constrain resizing from any edge; moving must clamp to the
  image bounds, resizing must clamp without moving the opposite edge.
- Track pressed modifiers from the event (`altKey`, `shiftKey`), never from a keys-down
  set that can go stale (react-image-crop #503).
- The output canvas needs a CORS-clean image (`crossOrigin="anonymous"` and the server's
  headers) and stays under the platform's canvas size limit.

## Testing notes

- Pure geometry in Node: move, resize from each edge with aspect and min size, bounds,
  zoom around a point, rotation by 90°, flip, and the natural-pixel output for every
  combination.
- Machine in Node: keyboard steps, debounced announcement on a virtual clock, pointer
  drag phases.
- Browser: pointer drag of the area and handles, pinch is a contract action with a
  synthetic two-pointer sequence, the output canvas pixels for a known image.

## Decisions

Aligned with Ark's capabilities (the reference implementation among the nine), fixing what
the research found.

1. **Viewport model** (Zag's): the crop in viewport pixels; the image placed by an affine
   transform of `zoom`, free `rotation`, `flip` and a pan `offset`; the natural-pixel crop
   (rect and corner quad) derived through the inverse matrix, and the export drawn with the
   same matrix. Pure functions in `core` (`geometry.ts`), no DOM.
2. **Exact coverage** instead of Zag's bounding box: the pan, zoom and rotation are clamped
   so that every crop corner maps inside the natural image (the inverse matrix), so the
   output never has empty corners.
3. **Ark's props and API**, rind-ui's conventions (controllable `crop`, `zoom`, `rotation`,
   `flip` with `on…Change(value, details)`; `fixedCropArea`; nudge steps 1 / 10 / 50;
   min / max sizes; `aspectRatio`; `cropShape`).
4. **One focusable crop area**: `role="slider"`, roledescription "crop area", value text
   with the rectangle in natural pixels, instructions as description; handles
   `aria-hidden`. With `fixedCropArea` it stays focusable and its arrows pan (zag#3264).
5. **No live root**: after keyboard changes, the rectangle is announced once (debounced
   500 ms) through the announcer; zoom and rotation changes from the API are not announced
   (their controls are the consumer's and announce themselves).
6. **Pointer**: drag area, eight handles (Shift locks the ratio), pan outside the area,
   wheel zoom around the pointer, pinch zoom; touch-action none on the viewport.
7. **Output**: `core/dom/crop-image.ts` `cropImage(image, data, { type, quality, output })`
   with a typed `CropError` (`tainted`, `too-large`, `not-loaded`).

## Open questions

- Multiple selections (Cropper.js): out of scope.
