# portal Specification

## Purpose
Decides where portalled overlay content renders — including inside a consumer's
native modal dialog, top-layer popover, fullscreen element or shadow root — and
makes portals safe for server rendering and hydration, without changing layer
behaviour.
## Requirements
### Requirement: Target Resolution

Portalled content SHALL render into, in order: the container the consumer passed;
otherwise the nearest open modal `<dialog>`, open top-layer popover or
`document.fullscreenElement` that contains the layer's logical parent element (its
trigger, or its parent layer's content); otherwise the shadow root that contains the
logical parent; otherwise the `body` of the logical parent's own document.

#### Scenario: Inside a consumer's native dialog

- **WHEN** a rind select is used inside a `<dialog>` opened with `showModal()` by the
  consumer
- **THEN** the listbox renders inside that `<dialog>`, is not inert, and can be
  operated by pointer and keyboard (native-platform.md §1)

#### Scenario: Fullscreen element

- **WHEN** a menu is opened from a video player that is in fullscreen
- **THEN** the menu renders inside the fullscreen element and is visible
  (react-spectrum#10506)

#### Scenario: Shadow root

- **WHEN** a dialog's trigger lives in an open shadow root
- **THEN** the dialog renders inside that shadow root, so the shadow root's styles
  apply (regression: ark#2714)

### Requirement: Container Changes Are Applied

When the consumer changes the portal container while the content is mounted, the
content SHALL move to the new container.

#### Scenario: Container prop changes

- **WHEN** a dialog's portal container prop changes from `null` to an element after
  mount
- **THEN** the dialog content is rendered inside that element (regression:
  radix#3599)

### Requirement: Server Rendering And Hydration

A portal SHALL render nothing on the server and nothing on the client's hydration
render, and SHALL mount its content after hydration, so server and client markup
match.

#### Scenario: Default open on the server

- **WHEN** a dialog with `defaultOpen` is server-rendered and hydrated
- **THEN** hydration reports no mismatch and the dialog opens after hydration
  (regression: radix#1386)

### Requirement: Portal Host Attributes

The portal's host element SHALL carry `data-rind-portal`, and SHALL copy `dir`, `lang`,
`data-rind-theme` and `data-theme` from the nearest ancestors of its logical parent
element that carry them, and SHALL keep all four in sync while mounted, so
right-to-left layout, speech language, key mirroring, the tenant theme and the
light/dark scheme are the same as in the inline tree.

#### Scenario: Right-to-left subtree

- **WHEN** a menu is opened from a trigger inside a `dir="rtl"` `lang="ar"` section
  and its content is portalled to `body`
- **THEN** the portal host has `dir="rtl"` and `lang="ar"`

#### Scenario: Portal content keeps the tenant theme

- **WHEN** a dialog is opened from inside `[data-rind-theme="acme"]` and portalled to
  `body`
- **THEN** the portal host has `data-rind-theme="acme"` and the dialog uses the acme
  tokens

#### Scenario: Scheme switch while open

- **WHEN** the page switches its ancestor from `data-theme="light"` to `"dark"` while a
  portalled toast is open
- **THEN** the portal host's `data-theme` follows within the same frame

### Requirement: Portalling Does Not Change Behaviour

Layer membership, nesting, dismissal and focus restore SHALL be the same whether a
layer's content is portalled or rendered inline. Dismissal SHALL NOT depend on
framework event bubbling through the portal.

#### Scenario: Inline dialog

- **WHEN** the same dialog is rendered once inline and once portalled
- **THEN** both pass the same contract tests

#### Scenario: Events bubbling through the portal

- **WHEN** a click inside portalled content bubbles, through the framework's
  synthetic event tree, to a handler on an ancestor of the trigger that stops
  propagation
- **THEN** layer dismissal behaves as if the handler were not there (regression:
  mui/base-ui#2312)

