## ADDED Requirements

### Requirement: Anatomy

An Image Cropper SHALL consist of `Root`, `Viewport`, `Image` and `Selection`, and MAY contain
`Handle`s (eight positions) and `Grid`s. `Selection` SHALL be the only focusable part.
`Image`, `Handle` and `Grid` SHALL be `aria-hidden`. No part SHALL be a live region. Every
part SHALL accept the `render` prop.

#### Scenario: One tab stop

- **WHEN** an Image Cropper with eight handles is rendered
- **THEN** Tab reaches exactly one element, the Selection, a `slider` with the
  roledescription "crop area"

### Requirement: Transform And Output

The image SHALL be placed by one affine transform of zoom, rotation (any angle), flip and a
pan offset. The crop's natural-pixel data (`rect` and the four `corners`) SHALL be computed
through the inverse of the same transform, and `cropImage` SHALL draw with that same
transform.

#### Scenario: Flip and rotation map to the right pixels (zag#3238)

- **WHEN** an image is flipped horizontally and rotated 90° and the crop covers its top-left
  quarter on screen
- **THEN** the natural rect is the quarter of the source image that appears there

### Requirement: Coverage

The image SHALL cover the crop: every crop corner SHALL map inside the natural image after
any pan, zoom, rotation, flip, move or resize. Where a rotation needs it, zoom SHALL be
raised to the smallest value that covers.

#### Scenario: Free rotation keeps the corners

- **WHEN** the rotation is set to 30° at zoom 1
- **THEN** zoom rises until all four crop corners are inside the image

### Requirement: Crop Changes

`crop`, `zoom`, `rotation` and `flip` SHALL be controllable, each with an `on…Change`.
Moving SHALL keep the crop inside the viewport. Resizing from a handle SHALL keep the
opposite edges fixed, respect `minWidth`, `minHeight`, `maxWidth`, `maxHeight` and
`aspectRatio` (`cropShape="circle"` implies 1), and Shift SHALL lock the current ratio.
With `fixedCropArea`, the crop SHALL stay at the default crop and drags SHALL pan the image.

#### Scenario: Minimum size

- **WHEN** a handle is dragged inward past `minWidth`
- **THEN** the width stops at `minWidth`

### Requirement: Keyboard

On the Selection:
- arrows SHALL move the crop by `nudgeStep`, by `nudgeStepShift` with Shift, and by
  `nudgeStepCtrl` with Ctrl or Cmd;
- with `fixedCropArea`, arrows SHALL pan the image instead;
- Alt+arrows SHALL resize the right or bottom edge;
- `+`, `=` and `-` SHALL zoom by `zoomStep` around the crop centre.

Modifiers SHALL be read from each event.

#### Scenario: Fixed area stays usable (zag#3264)

- **WHEN** a keyboard user tabs to a cropper with `fixedCropArea` and presses ArrowRight
- **THEN** the image pans and the crop's natural rect changes

### Requirement: Announcement

After keyboard changes, the Image Cropper SHALL announce `messages.valueText` of the natural
rect once, 500 ms after the last change, politely. The Selection's `aria-valuetext` SHALL
always hold it.

#### Scenario: A burst announces once

- **WHEN** ArrowRight is pressed five times within 500 ms
- **THEN** one announcement is made, with the final rectangle

### Requirement: Pointer And Touch

Dragging the Selection SHALL move it, dragging a Handle SHALL resize, and dragging outside
the Selection SHALL pan. The wheel SHALL zoom by `zoomStep` around the pointer. A two-finger
pinch SHALL zoom with `zoomSensitivity`.

#### Scenario: Wheel zoom around the pointer

- **WHEN** the wheel zooms in over a point of the image
- **THEN** that point stays under the pointer

### Requirement: Output

`cropImage(image, data, options)` SHALL resolve with a Blob or a data URL of the crop, and
SHALL reject with `CropError` coded `not-loaded`, `tainted` (CORS) or `too-large`.

#### Scenario: Tainted canvas (ark#3901)

- **WHEN** the image comes from another origin without CORS
- **THEN** `cropImage` rejects with `CropError` code `tainted`

### Requirement: Data Attributes

Every part SHALL carry `data-scope="image-cropper"`, `data-part` and `data-instance`. Root
and Selection SHALL carry `data-dragging` and `data-panning` while active, plus
`data-shape`. Handle SHALL carry `data-position`, and Grid `data-axis`.

#### Scenario: Dragging attribute

- **WHEN** the selection is being dragged
- **THEN** Root and Selection carry `data-dragging`

### Requirement: Contract

The Image Cropper SHALL ship `imageCropperContract`, located by the Root's name, with the
actions `nudge`, `resize`, `zoomIn`, `zoomOut`, `dragSelection` and `dragHandle`, the
queries `crop`, `zoom`, `valueText` and `covered`, and a `getImageCropper` driver.

#### Scenario: Driver

- **WHEN** a test calls `nudge(10, 0)`
- **THEN** `crop().x` grew

### Requirement: Theme

`@rind-ui/theme` SHALL ship `image-cropper.css` in `@layer rind.components` with `:where()`
selectors, family `decoration`, handles with 24 × 24 px hit areas, a circle shape, and
forced-colours support.

#### Scenario: Hit areas

- **WHEN** a handle is measured
- **THEN** its hit area is at least 24 × 24 px
