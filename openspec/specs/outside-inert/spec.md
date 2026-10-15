# outside-inert Specification

## Purpose
Removes everything outside the topmost modal layer from keyboard, pointer and
assistive-technology access with `inert`, while keeping the right things exposed
(descendant layers, live regions, opted-out top-layer regions) and restoring the
page exactly when the layer closes.
## Requirements
### Requirement: Inert Outside The Topmost Modal Layer

While a modal layer is open, every element outside the topmost modal layer and its
descendant layers SHALL be made `inert`, by marking the siblings of each element on
the path from `<body>` to every kept element. The kept elements' ancestors SHALL
never be marked. `aria-hidden` SHALL NOT be used as the mechanism, alone or in
addition. `<html>` and `<body>` SHALL never receive `inert` or `aria-hidden`.

#### Scenario: Page behind a dialog

- **WHEN** a modal dialog portalled to `body` is open
- **THEN** the application root is `inert`, the dialog's elements are not, and
  neither `<html>` nor `<body>` carries `inert` or `aria-hidden` (regression:
  ark#2715, ark#2844)

#### Scenario: Focusable content is never aria-hidden

- **WHEN** a modal dialog is open
- **THEN** no element outside it is `aria-hidden="true"` while still focusable
  (regression: reka-ui#2922, mui/base-ui#4678)

### Requirement: Recomputed From The Stack

Outside hiding SHALL be recomputed whenever the topmost modal layer changes: a child
modal re-targets it, and closing the child restores the parent's set. It SHALL
apply only to modal layers; non-modal layers SHALL NOT hide or inert anything.

#### Scenario: Nested modal

- **WHEN** a nested modal dialog opens from a modal dialog
- **THEN** the parent dialog is inert, the nested dialog and its ancestors are not,
  and the nested dialog has no `aria-hidden` or `inert` ancestor (regression:
  zag#3408)

#### Scenario: Non-modal combobox

- **WHEN** a non-modal combobox popup is open
- **THEN** no element on the page is made inert or hidden (regression: ark#3699,
  reka-ui#2240)

#### Scenario: Portalled child of a modal

- **WHEN** a select opened inside a modal dialog renders its listbox in a portal at
  the end of `body`
- **THEN** the listbox is not inert and is fully interactive (regression: ark#3728)

### Requirement: What Stays Exposed

Outside hiding SHALL decide what stays exposed with the single keep-visible rule
exported by the `announcer` capability (`add-a11y-foundations`), never with a copy of
its list, and SHALL additionally skip `script`, `style`, `template` and `link`
elements. Under that rule the following are never made inert: the shared live
announcer (`data-live-announcer`); elements marked `data-rind-top-layer` (toast
regions, consumer opt-outs); elements with `aria-live` or role `status`, `alert` or
`log`, together with the path to them. The announcer SHALL NOT be moved into the modal layer; it stays at
document level and exposed.

#### Scenario: Toast above a dialog

- **WHEN** a toast region marked `data-rind-top-layer` shows a toast with an "Undo"
  action while a modal dialog is open
- **THEN** the toast is not inert, is announced, and "Undo" can be pressed
  (regression: radix#4115)

#### Scenario: One rule for every hide-outside operation

- **WHEN** the keep-visible rule gains a new selector
- **THEN** outside hiding honours it with no change to this module

#### Scenario: Live region in the page

- **WHEN** a status region inside the application root updates while a modal dialog
  is open
- **THEN** the region is not inside an inert subtree (regression: radix#1820)

### Requirement: Nodes Added While Open Are Left Alone

Elements inserted into the document after outside hiding was applied SHALL NOT be
made inert, unless they are inside an already-inert subtree. This keeps browser
extension overlays, password managers and third-party portals usable while a modal
layer is open.

#### Scenario: Password manager

- **WHEN** a password manager inserts its autofill menu into `body` while a login
  dialog is open
- **THEN** the menu is not inert and can be used (regression: radix#2219,
  react-spectrum#8784)

### Requirement: Reference-Counted, Exact Restore

Marks SHALL be reference-counted per element so that overlapping or nested modal
layers never remove each other's marks. An element that already had `inert` from
the author SHALL keep it after every layer closes. When the last modal layer closes,
every element SHALL be back to its state before the first layer opened.

#### Scenario: Author's own inert

- **WHEN** a page section has `inert` set by the author and a modal dialog opens and
  closes
- **THEN** that section still has `inert`

#### Scenario: DOM clean

- **WHEN** two sibling modal dialogs open and close in any order
- **THEN** after both are closed, no element has an `inert` attribute that it did not
  have before the first opened

### Requirement: Closing Content Is Inert While It Exits

From the moment a layer closes until its presence completes, the layer's own
content SHALL be `inert`, so focus and assistive technology cannot stay in content
that is animating out.

#### Scenario: Tab during exit

- **WHEN** a dialog is closing with an exit animation and the user presses Tab
- **THEN** focus does not enter the closing dialog

