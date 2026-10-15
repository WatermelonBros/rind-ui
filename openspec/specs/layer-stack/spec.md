# layer-stack Specification

## Purpose
Keeps one ordered record of the open overlay layers in each document, with explicit
parentage, so that dismissal, focus containment, outside hiding and scroll lock all
agree on which layer is topmost, which layers are nested and what counts as inside.
## Requirements
### Requirement: One Stack Per Document

The system SHALL keep exactly one layer stack per document. Every overlay module
(dismiss, focus containment, outside hiding, scroll lock) SHALL derive "topmost",
"topmost modal" and "inside" from that stack and SHALL NOT keep a stack of its own.
The stack SHALL be stored on the document itself, under a versioned global key,
so that two copies of `@rind-ui/core` loaded in one page share it.

#### Scenario: Two copies of the library

- **WHEN** a page bundles two copies of `@rind-ui/core` (version drift between
  packages) and a layer from one copy opens a layer from the other
- **THEN** both layers are in the same stack, Escape closes only the topmost, and an
  outside press inside the child does not dismiss the parent (regression:
  radix#1088, radix#2961, react-spectrum#8784)

#### Scenario: Multiple documents

- **WHEN** layers open in the main document and in a same-origin iframe
- **THEN** each document has its own stack and Escape in one never closes a layer in
  the other

### Requirement: Registering A Layer

A layer SHALL be registered with its kind, its stacking family (defaulting to its
kind; for example Dialog and Alert Dialog both register the family `dialog`), whether
it is modal, its parent layer (if any), a live accessor for the elements that belong
to it (content, backdrop, positioner and, optionally, its trigger) and, optionally,
which of those elements are dismiss surfaces (see `dismissable-layer`). Every element
that belongs to a layer is inside it for outside-inert, dismissal and the inside /
topmost queries. Registration SHALL return a handle. Registering the same layer id twice
SHALL be idempotent, and releasing a handle twice SHALL be a no-op.

#### Scenario: Strict mode double registration

- **WHEN** a layer is registered, released and registered again with the same id
  because the framework double-invokes effects
- **THEN** the stack contains the layer once, and its nesting metadata is correct
  (regression: ark#3842)

#### Scenario: Double release

- **WHEN** a handle is released twice
- **THEN** the second release changes nothing and throws nothing

### Requirement: Explicit Parentage

Nesting SHALL be decided by the parent declared at registration. When no parent is
declared, the system SHALL use DOM containment of the layer's opening element
(trigger) inside another open layer as the parent. A layer with neither SHALL be a
root layer. Stack order alone SHALL NOT make a layer nested: two root layers are
siblings even when one was opened after the other.

#### Scenario: Sibling dialogs

- **WHEN** a dialog is open and a second, unrelated dialog is opened from a toast
- **THEN** the second dialog is a root layer, not a child of the first, and closing
  either leaves the other fully interactive (regression: radix#3648,
  mui/base-ui#1320)

#### Scenario: Portalled child

- **WHEN** a menu whose trigger is inside a dialog renders its content in a portal
  at the end of `body`
- **THEN** the menu is a child of the dialog and its content counts as inside the
  dialog

### Requirement: Inside And Topmost Queries

The stack SHALL answer, at any time: the topmost layer; the topmost modal layer;
whether an event target is inside a given layer, meaning inside the layer's own
elements or inside any of its descendant layers' elements; each layer's depth, its
index in the stack and the number of open descendant layers.

#### Scenario: Target inside a grandchild

- **WHEN** a press lands inside a tooltip opened from a select opened from a dialog
- **THEN** the stack reports the target as inside the tooltip, the select and the
  dialog

### Requirement: Logically Inside An Element

The stack SHALL answer, for any target T and any element E (which need not be a layer),
whether T is logically inside E: T is inside E's DOM subtree, OR T is inside the elements
of an open layer whose logical parent chain leads into E, meaning the layer's opener, or
the opener or elements of any of its ancestor layers (by explicit parentage), is inside
E's subtree. A `null` target SHALL be reported as not inside. This lets a non-layer
container (a Field, from `add-field`) treat focus in a portalled popup opened from its
control as still inside it, for touched and blur validation.

#### Scenario: Portalled Select popup inside a Field

- **WHEN** a Select whose trigger is inside a Field element renders its popup in a portal
  at the end of `body`, and focus moves from the trigger into the popup
- **THEN** the stack reports the focused option as logically inside the Field element

#### Scenario: Nested layer from a portalled popup

- **WHEN** a tooltip is opened from an option of that portalled Select popup
- **THEN** a target inside the tooltip is logically inside the Field element

#### Scenario: Unrelated layer

- **WHEN** a dialog opened from a button outside the Field is focused
- **THEN** its targets are not logically inside the Field element

### Requirement: Release On Close, Not On Unmount

A layer SHALL be released when its owner closes, before any exit animation runs.
After release the layer SHALL no longer be topmost, SHALL no longer receive Escape
or outside interactions, and the layers beneath SHALL be recomputed immediately. A
released layer whose content is still animating out SHALL stay known to the stack as
exiting until its presence completes, only so that presses landing on it are not
treated as outside presses by the layers beneath.

#### Scenario: Escape during an exit animation

- **WHEN** a nested dialog closes with a 300 ms exit animation and the user presses
  Escape during the animation
- **THEN** the parent dialog closes; the exiting dialog does not swallow the key

#### Scenario: Click on an exiting layer

- **WHEN** the top modal closes with an exit animation and the user clicks inside its
  still-visible content
- **THEN** the modal beneath stays open (regression: react-spectrum#10291)

### Requirement: Removing A Parent Dismisses Its Children

Releasing a layer SHALL first dismiss every open descendant layer, topmost first,
with the reason `parent-dismissed`.

#### Scenario: Dialog closes with an open menu

- **WHEN** a dialog closes programmatically while a menu opened from it is open
- **THEN** the menu receives a dismiss with reason `parent-dismissed` before the
  dialog's layer is released

### Requirement: Unmount And Navigation Release Everything

When an owner is destroyed while its layer is open (unmount, route change, a
conditionally rendered root removed), the layer and everything derived from it
(outside hiding, scroll lock, focus containment) SHALL be released exactly as on
close.

#### Scenario: Link inside a dialog navigates away

- **WHEN** a link inside an open modal dialog navigates to another route and the
  dialog unmounts without closing
- **THEN** the page has no scroll lock, no `inert` and no leftover attribute or style
  on `<html>` or `<body>` (regression: radix#3797, ark#3842)

#### Scenario: Mounted but closed

- **WHEN** a layer's content is kept mounted while closed (force mount, keep
  mounted)
- **THEN** no layer is registered and nothing is locked or hidden (regression:
  radix#3100)

### Requirement: Stacking Metadata For Styling

The stack SHALL expose, per layer, whether it is nested inside a layer of the same
stacking family, whether it has open descendants of the same family, its index and its nested
count, so that components can expose them as `data-nested`, `data-has-nested`,
`--layer-index` and `--nested-layer-count` on their layer parts. The stack SHALL NOT
write attributes to the DOM itself.

#### Scenario: Stacked dialogs

- **WHEN** a dialog opens a nested dialog
- **THEN** the parent's metadata reports `hasNested` and a nested count of 1, the
  child's reports `nested` and an index one higher than the parent's

#### Scenario: Alert dialog over a dialog

- **WHEN** an alert dialog (family `dialog`) opens from inside a dialog
- **THEN** the dialog reports `hasNested`, and the alert dialog reports `nested` with
  an index one higher than the dialog's

#### Scenario: Trigger kept exposed under a modal menu

- **WHEN** a modal menu registers its trigger among its elements and opens
- **THEN** the trigger is not made inert, so the menu's `aria-labelledby` pointing at
  it still resolves in Chromium (RA#9737), and pressing the trigger is not an outside
  press

