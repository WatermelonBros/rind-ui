## Purpose

Stops the page behind an open modal layer from scrolling — on desktop and on iOS —
without layout shift, without blocking zoom or scrolling inside the layer, and
restores the page's own styles exactly when the last modal layer closes.

## ADDED Requirements

### Requirement: Locked While Any Modal Layer Is Open

The page SHALL be scroll-locked while at least one modal layer is open in the
document, and unlocked when the last one closes. Locking SHALL be
reference-counted per document; overlapping, nested and sibling modal layers SHALL
produce one lock. Non-modal layers SHALL NOT lock scrolling.

#### Scenario: Two modals

- **WHEN** a modal dialog opens a nested modal dialog and the nested one closes
- **THEN** the page stays locked until the parent closes too

#### Scenario: Non-modal popover

- **WHEN** only a non-modal popover is open
- **THEN** the page scrolls normally

### Requirement: The Right Scroller

The lock SHALL apply to the element that actually scrolls the page: the document's
scrolling element, or `<body>` when `<html>` has `overflow: hidden` or `clip` and
`<body>` is the scroll container. An `overflow: hidden` already set on `<html>` SHALL
NOT be taken to mean the page is locked.

#### Scenario: App shell scrolling on body

- **WHEN** the author sets `html { overflow: hidden }` and `body { overflow-y: auto }`
  and a modal dialog opens
- **THEN** `<body>` stops scrolling (regression: mui/base-ui#5720)

### Requirement: No Layout Shift

When locking hides a classic scrollbar, the system SHALL compensate with padding on
the scroller's inline-end side (the left side in right-to-left documents) equal to
the scrollbar width, and SHALL expose the width as `--rind-scrollbar-width` on
`<html>` so fixed-position elements can compensate too. When the author already
reserves the gutter with `scrollbar-gutter: stable`, the system SHALL add no
padding. The system SHALL NOT set `scrollbar-gutter` itself. While locked, the
scroller SHALL carry `data-rind-scroll-locked`.

#### Scenario: Classic scrollbar

- **WHEN** a page with a 15 px classic scrollbar opens a modal dialog
- **THEN** the content does not move horizontally and `--rind-scrollbar-width` is
  `15px`

#### Scenario: Author uses a stable gutter

- **WHEN** the page sets `scrollbar-gutter: stable` on `<html>` and a modal dialog
  opens
- **THEN** no padding is added and the content does not move (regression:
  radix#3251)

#### Scenario: No visible gutter added

- **WHEN** a page without `scrollbar-gutter` opens a side drawer
- **THEN** the system does not add `scrollbar-gutter: stable` to `<html>`
  (regression: mui/base-ui#4645)

### Requirement: Zoom And Inner Scrolling Keep Working

The lock SHALL NOT prevent wheel or keyboard scrolling inside the layer, browser zoom
(Ctrl/⌘ + wheel, pinch), trackpad history swipes, or scrolling of descendant layers
that render outside the modal layer's DOM. On desktop it SHALL use no wheel or touch
listeners.

#### Scenario: Pinch zoom

- **WHEN** a user pinches to zoom while a modal dialog is open on a touch device
- **THEN** the page zooms (regression: radix#2860, react-spectrum#1898)

#### Scenario: Popover inside a dialog

- **WHEN** a scrollable popover portalled outside a modal dialog is open from it
- **THEN** the popover's list scrolls with the wheel (regression: radix#1159)

### Requirement: iOS Behaviour

On iOS and iPadOS, where `overflow: hidden` on the root does not stop scrolling, the
system SHALL prevent a `touchmove` only when the nearest scrollable ancestor of its
target is the page or cannot scroll in the gesture's direction, and SHALL allow
two-finger gestures, range inputs, text-selection handles, and touches that start
inside an element whose `touch-action` excludes the gesture's axis (a Slider control
with `touch-action: pan-y` dragged horizontally, RA#9493). The layer's content
and backdrop SHALL get `overscroll-behavior: contain` while locked. The system SHALL
NOT use the `position: fixed` body technique and SHALL NOT patch
`HTMLElement.prototype.focus`.

#### Scenario: Sibling dialogs on iPhone

- **WHEN** a dialog closes and a sibling dialog opens in the same gesture handler on
  iOS, and the user swipes inside the new dialog
- **THEN** the new dialog's content scrolls; the touch policy reads the layers open
  at touch time, not those open when the lock started (regression:
  headlessui#3890, headlessui#2168)

#### Scenario: Scroll inside a long dialog on iPhone

- **WHEN** a user scrolls the content of a long modal dialog on iOS Safari to its end
  and keeps swiping
- **THEN** the page behind does not scroll and does not jump when the dialog closes
  (regression: radix#3078)

#### Scenario: Selecting text in an input on iPhone

- **WHEN** a user drags a text-selection handle inside an input in a modal dialog on
  iOS
- **THEN** the selection extends (regression: radix#3331)

### Requirement: Synchronous And CSP-Safe

Locking and unlocking SHALL take effect synchronously when the stack changes, with
no deferred application or cleanup that could run after a later lock, unlock or
document teardown. Styles SHALL be applied through the CSS object model on elements
(never the `style` attribute string or an injected `<style>` element), so pages
with a hash- or nonce-based `style-src` policy work without violations.

#### Scenario: Lock and unlock in one task

- **WHEN** a modal opens and closes in the same task (a cookie banner accepted at
  once)
- **THEN** the page is unlocked afterwards (regression: reka-ui#2480)

#### Scenario: Close one, open another

- **WHEN** an animated modal closes and another modal opens in the same handler
- **THEN** the page stays locked while the second is open (regression:
  ariakit#2528)

#### Scenario: Strict CSP

- **WHEN** a page with `style-src 'sha256-…'` (no `unsafe-inline`) opens and closes a
  modal dialog
- **THEN** no CSP violation is reported and the lock works (regression:
  bits-ui#1995)

### Requirement: Exact Restore

The first lock SHALL snapshot the inline styles and attributes it changes on the
scroller and on `<html>`; the last unlock SHALL restore them exactly, including when
the owner unmounts without closing and under framework double mounts. When another
script changes one of those properties while the lock is held (for example a
different library releasing its own lock late), the system SHALL take the new
value as the value to restore and keep the page locked. Locking SHALL NOT change
the page's scroll position, also when `<html>` has `scroll-behavior: smooth`.

#### Scenario: Another library's lock released late

- **WHEN** a third-party menu that locked scrolling closes, a modal dialog opens
  before the menu removes its `overflow: hidden`, the menu then removes it, and the
  dialog later closes
- **THEN** the page stays locked while the dialog is open and is scrollable after it
  closes (regression: mui/base-ui#4640)

#### Scenario: Smooth scrolling page

- **WHEN** a page scrolled halfway with `html { scroll-behavior: smooth }` opens and
  closes a modal dialog
- **THEN** the scroll position never changes (regression: mui/base-ui#1340)

#### Scenario: Strict mode unmount while open

- **WHEN** a component tree containing an open modal dialog is removed under React
  Strict Mode
- **THEN** `overflow`, padding, `--rind-scrollbar-width` and
  `data-rind-scroll-locked` are back to their previous values (regression:
  ark#3842)
