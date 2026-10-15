## Purpose

Defines rind-ui's Fieldset: a native `<fieldset>` that names and describes a group of related
controls, shows a group-level error, and disables every control inside it, native and
rind-ui alike. Introduced by `add-fieldset`.

## ADDED Requirements

### Requirement: Anatomy

The Fieldset SHALL consist of a `root` part (`<fieldset>`), an optional `legend` part
(`<legend>`, rendered as the root's first child), an optional `description` part (`<p>`)
and an optional `error-message` part (`<p>`). Every part SHALL accept element
substitution and forward the attributes of its element. The Fieldset SHALL have no machine.
Its props are `disabled` and `invalid`.

#### Scenario: Default markup

- **WHEN** a Fieldset with a Legend "Shipping address" and a Description is rendered
- **THEN** the DOM is a `<fieldset>` whose first child is `<legend>Shipping address</legend>`

### Requirement: Group Name And Description

The root SHALL be named by its Legend. When the Legend is a native `<legend>` that is the
root's first child, the name SHALL come from it natively, and the root SHALL carry neither
`aria-labelledby` nor `role`. When the Legend is substituted (another element), or the root
is substituted, the root SHALL carry `aria-labelledby` with the Legend's id. The root's
`aria-describedby` SHALL list the ids of the Description and, while it is rendered, the
ErrorMessage, together with consumer ids. It SHALL be omitted when the list is empty, and
SHALL never be an empty string.

#### Scenario: Native legend (ark#3614)

- **WHEN** a Fieldset renders its Legend "Contact" as a native first-child `<legend>`
- **THEN** the root's accessible name is "Contact" and it has no `aria-labelledby` and no
  `role`

#### Scenario: Substituted legend (base-ui#3044)

- **WHEN** the Legend is rendered as a `<div>` through `render`
- **THEN** the root's `aria-labelledby` points at the div and its accessible name is the
  div's text

#### Scenario: No description (ark#3707)

- **WHEN** a Fieldset renders neither a Description nor an ErrorMessage
- **THEN** the root has no `aria-describedby` attribute

#### Scenario: Description and error (base-ui#3260)

- **WHEN** a Fieldset with a Description "All fields required" is `invalid` and renders an
  ErrorMessage "Enter an address"
- **THEN** the root's accessible description contains both texts, description first

### Requirement: Error Message

The ErrorMessage SHALL render only while `invalid` is true, unless the consumer forces it
to mount. It SHALL NOT be a live region. `invalid` SHALL NOT be passed to the controls
inside the Fieldset, which keep their own validity.

#### Scenario: Invalid is not cascaded (ark#2928)

- **WHEN** an `invalid` Fieldset contains a valid Text Field
- **THEN** the Text Field's input has no `aria-invalid`, and the Fieldset's ErrorMessage is
  rendered

### Requirement: Disabled Propagation

A `disabled` Fieldset SHALL disable every control inside it:

- native form controls, through the native `disabled` attribute on the `<fieldset>`;
- every rind-ui control and Field, including parts rendered as non-form elements and parts
  portalled outside the fieldset, through a fieldset context that the control reads in
  addition to its own `disabled` prop;
- nested Fieldsets: an inner Fieldset is disabled whenever any enclosing Fieldset is
  disabled.

As in HTML, controls inside the root's first Legend SHALL stay enabled. A disabled rind-ui
control inside a disabled Fieldset SHALL behave exactly as with its own `disabled` prop
(`data-disabled`, activation ignored, not submitted). When the root is substituted by a
non-`fieldset` element it SHALL carry `role="group"` and `aria-disabled="true"` while
disabled, and the context SHALL still disable rind-ui controls. Native controls are then
not disabled, and a development warning says so.

#### Scenario: Div-based control (headlessui#1802)

- **WHEN** a Radio Group whose items are rendered as `div`s is inside a disabled Fieldset
- **THEN** every item carries `aria-disabled="true"` and clicking one does not change the
  value

#### Scenario: Portalled content (radix#2417)

- **WHEN** a Select inside a disabled Fieldset is clicked
- **THEN** it does not open and its trigger carries `data-disabled`

#### Scenario: Toggling at runtime (headlessui#194)

- **WHEN** a Fieldset containing a Switch becomes disabled
- **THEN** the Switch gains `data-disabled` and pressing Space does not toggle it, and
  after the Fieldset is enabled again it toggles

#### Scenario: Nested fieldsets

- **WHEN** an enabled Fieldset is inside a disabled Fieldset
- **THEN** the inner Fieldset carries `data-disabled` and its controls are disabled

#### Scenario: Control inside the first legend

- **WHEN** a disabled Fieldset's Legend contains a "select all" Checkbox
- **THEN** that Checkbox stays enabled, and a Checkbox elsewhere in the Fieldset is
  disabled, the same as with native checkboxes in the same markup

#### Scenario: Submission

- **WHEN** a form containing a disabled Fieldset with a named Text Field and a named
  Checkbox is submitted
- **THEN** neither value is in the form data

### Requirement: Data Attributes

Every part SHALL carry `data-scope="fieldset"`, its `data-part` (`root`, `legend`,
`description`, `error-message`) and `data-instance`, and, when they apply, `data-disabled`
(the Fieldset's effective disabled state, inherited ones included) and `data-invalid`.

#### Scenario: Inherited disabled

- **WHEN** a Fieldset is disabled only because an outer one is
- **THEN** its root and Legend carry `data-disabled`

### Requirement: Contract

The Fieldset SHALL ship a contract with scope `fieldset`, anatomy `root`, `legend`,
`description`, `error-message`, located by role `group` and exact accessible name, with:

- actions: none. Its props `disabled` and `invalid` are covered by prop steps
  (`$props:disabled`, `$props:invalid`).
- queries: `name`, `description`, `isDisabled`, `isInvalid`, `errors` (the ErrorMessage's
  text, or `null`);
- states: none;
- traits: none.

#### Scenario: Driver

- **WHEN** a test runs `getFieldset(screen, { name: "Shipping address" }).isDisabled()`
  against a disabled Fieldset, and the same code with a Playwright `page`
- **THEN** both return `true`

### Requirement: Theme

`@rind-ui/theme` SHALL style the Fieldset through its `data-*` attributes only, in
`fieldset.css`. It SHALL normalise the Legend so that it lays out as an ordinary block (no
gap cut into the border), set `min-inline-size: 0` on the root so it shrinks with its
container, style the ErrorMessage with the danger role, and read only `--rind-fieldset-*`
tokens with semantic fallbacks. The Fieldset belongs to no variant family.

#### Scenario: Legend in a flex layout

- **WHEN** a Fieldset is rendered in a 320 CSS px wide container with a long Legend
- **THEN** the Legend wraps inside the container and nothing overflows horizontally
