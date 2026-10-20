## Why

Avatars, covers and product photos need cropping, and the one headless implementation (Zag)
and the popular libraries keep failing in the same places:
- the output is the wrong region after a flip or rotation (zag#3238);
- keyboard users lose the only focusable element (zag#3264), cannot resize
  (react-image-crop#403), or hear nothing when the area changes (react-image-crop#537);
- a whole live region re-reads the cropper;
- tainted canvases fail without a typed error (ark#3901).

Research: [image-cropper](../../../docs/research/image-cropper.md) ·
[accessibility](../../../docs/research/accessibility.md)

Depends on: `add-foundations`, `add-a11y-foundations` (announcer, scheduler),
`add-theme-system`.

## What Changes

- A public **Image Cropper** in `@rind-ui/core`:
  - machine, connect, contract, messages and meta;
  - pure geometry (`components/image-cropper/geometry.ts`): the affine transform,
    its inverse, coverage and constraints;
  - output in `core/dom/crop-image.ts` (`cropImage`).
- `@rind-ui/react` parts: `Root`, `Viewport`, `Image`, `Selection`, `Handle`, `Grid`.
- The capabilities are aligned with Ark's:
  - the crop area sits in the viewport, and the image moves under it (pan, zoom around a
    point, free rotation, flip);
  - `fixedCropArea`, `aspectRatio`, `cropShape`, min and max sizes;
  - nudge steps of 1, 10 and 50;
  - wheel and pinch zoom;
  - the output in natural pixels (a rect and the corner quad).
- Fixed relative to Zag:
  - the image always covers the crop (exact corner coverage, not a bounding box);
  - the selection stays focusable with `fixedCropArea`;
  - instead of a live root, the rectangle is announced once after keyboard changes;
  - CORS failures raise a typed error.
- `getImageCropper` driver, theme stylesheet, site examples, docs page.

## Impact

- New capability `image-cropper`.
