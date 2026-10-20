## ADDED Requirements

### Requirement: Anatomy

An Image Viewer SHALL consist of `Root`, `Viewport` (a focusable `role="group"` with
`aria-roledescription="image viewer"`, named by the image's alt) and `Image`, and MAY
contain `ZoomIn`, `ZoomOut`, `Reset` (buttons) and `ZoomText`. Every part SHALL accept the
`render` prop.

#### Scenario: Named group

- **WHEN** an Image Viewer shows an image with alt "Floor plan"
- **THEN** its Viewport is a focusable group named "Floor plan" with instructions as its
  description

### Requirement: Zoom

`zoom` SHALL be controllable (`zoom`, `defaultZoom`, `onZoomChange`), where 1 is the image
fitted in the viewport. It SHALL be clamped to `[minZoom, maxZoom]` (default `[1, 4]`) on
every change, programmatic ones included. Wheel and pinch SHALL zoom about the pointer, and
keys and buttons about the viewport centre. A pinch SHALL never pass a limit and come back.

#### Scenario: Limits

- **WHEN** ZoomIn is pressed at `maxZoom`
- **THEN** the zoom stays and ZoomIn has `aria-disabled="true"` and keeps focus

#### Scenario: About the pointer

- **WHEN** the user ctrl-wheels in over a point of the image
- **THEN** that point stays under the pointer

### Requirement: Pan Bounds

The image SHALL never leave the viewport: an axis larger than the viewport SHALL cover it,
and an axis that fits SHALL stay centred.

#### Scenario: Drag past the edge

- **WHEN** the user drags a zoomed image far to the right
- **THEN** its left edge stops at the viewport's left edge

### Requirement: Gestures

Dragging SHALL pan when zoomed. Ctrl-wheel, Safari's trackpad `gesturechange` and a
two-finger touch pinch SHALL zoom. A double click SHALL toggle between fit and
`doubleClickZoom` (default 2) about the point. A plain wheel SHALL scroll the page unless
`wheel="zoom"`. A resize of the viewport SHALL refit.

#### Scenario: Page scroll kept

- **WHEN** the user scrolls a plain wheel over a viewer at fit
- **THEN** the page scrolls and the zoom stays 1

### Requirement: Keyboard

On the Viewport, `+` / `=` SHALL zoom in, `-` SHALL zoom out and `0` SHALL reset. The arrows
SHALL pan by 10% of the viewport (50% with Shift) when there is room on that axis, and SHALL
be left to the page otherwise.

#### Scenario: Pan by keys

- **WHEN** the image is zoomed to 2 and the user presses ArrowRight
- **THEN** the view moves right and the zoom stays 2

### Requirement: Announcement

After keyboard or button changes, the viewer SHALL announce the zoom ("Zoom 200%") once,
politely, after a quiet 500 ms. Pointer gestures SHALL NOT announce. The Viewport SHALL NOT be
a live region.

#### Scenario: One announcement per burst

- **WHEN** the user presses `+` three times quickly
- **THEN** one announcement is made, with the final zoom

### Requirement: Data Attributes

Parts SHALL carry `data-scope="image-viewer"`, `data-part` and `data-instance`. The Root and
the Viewport SHALL carry `data-state`, `data-zoomed`, `data-panning` and `data-zoom`.

#### Scenario: Zoomed

- **WHEN** the zoom is 2
- **THEN** the Viewport carries `data-zoomed` and `data-zoom="2"`

### Requirement: Contract

The Image Viewer SHALL ship `imageViewerContract` with the actions `zoomIn`, `zoomOut`,
`reset` and `pan`, the queries `zoom`, `offset`, `canZoomIn` and
`canZoomOut`, and a `getImageViewer` driver.

#### Scenario: Driver

- **WHEN** a test calls `zoomIn()` twice with step 0.5
- **THEN** `zoom()` is 2

### Requirement: Theme

`@rind-ui/theme` SHALL ship `image-viewer.css` in `@layer rind.components` with `:where()`
selectors, family `decoration`: a viewport surface, a grab cursor when zoomed, a controls
toolbar, a focus ring and forced-colours support.

#### Scenario: Grab cursor

- **WHEN** the image is zoomed
- **THEN** the viewport's cursor is `grab`
