## 0. Research and spec

- [x] 0.1 Research note `docs/research/image-cropper.md` (Ark / Zag in detail)
- [x] 0.2 This change; `openspec validate add-image-cropper --strict`

## 1. Core

- [x] 1.1 `geometry.ts` (design §1) with Node tests: matrix and inverse, flip and rotation, coverage under free rotation, clamp and min-cover zoom, default crop, move and resize constraints
- [x] 1.2 Machine (design §3) and Node tests; announcement debounce on a manual clock
- [x] 1.3 Connect, messages, meta and tests
- [x] 1.4 `core/dom/crop-image.ts` with a browser test (pixels of a known image, tainted canvas)

## 2. React, contract, driver

- [x] 2.1 Parts (design §4); pointer, wheel and pinch wiring; keyboard
- [x] 2.2 Contract and `getImageCropper`

## 3. Tests

- [x] 3.1 DOM tests (browser) and model tests

## 4. Theme, site, docs

- [x] 4.1 `image-cropper.css` and browser test
- [x] 4.2 Site examples (avatar circle with zoom slider, free crop with rotate and flip buttons, fixed area, output preview) checked by screenshot in the base theme and a skin; skin; docs page; `docs/components.md` row; changeset

## 5. Proof

- [x] 5.1 `pnpm verify`, browser tests, site audit 0 findings
