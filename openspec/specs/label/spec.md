# label Specification

## Purpose
Defines rind-ui's standalone Label component: a native `<label>` that names a labelable
control through `for` or by wrapping it, follows `label-interaction`, and ships a contract
and driver. Introduced by `add-label`.
## Requirements
### Requirement: Anatomy

The Label SHALL consist of one part, `root`, which renders a `<label>` element by default.
It SHALL accept and forward every attribute of `<label>`, including `htmlFor` and `id`, and
SHALL accept element substitution (`render`). It SHALL have no machine and no state.

#### Scenario: Native element

- **WHEN** `<Label htmlFor="email">Email</Label>` is rendered
- **THEN** the DOM contains `<label for="email">Email</label>` carrying the scope
  attributes

### Requirement: Native Association

A Label whose `for` names a labelable element, or which wraps a labelable element, SHALL
name that element and activate it through the browser's native label behaviour, before
hydration and without JavaScript. The Label SHALL add no ARIA attribute and no role, and
SHALL never be given `role="label"` or any other role.

#### Scenario: Name from for (radix#638)

- **WHEN** a Label with text "Email" has `htmlFor` set to an input's id
- **THEN** the input's accessible name is "Email" and axe reports no violation

#### Scenario: Wrapping association (radix#1232)

- **WHEN** a Label wraps an `<input>` and has no `htmlFor`
- **THEN** clicking the Label text focuses the input and the input's name is the Label's
  text

#### Scenario: Server render (kobalte#652, radix#1577)

- **WHEN** a Label with `htmlFor` is server-rendered and clicked before hydration
- **THEN** the HTML carries the `for` attribute and the click focuses the input

#### Scenario: Hover reaches the control (radix#1233)

- **WHEN** the pointer hovers a Label for a checkbox input
- **THEN** the input matches `:hover`

### Requirement: Interaction

The Label SHALL follow every requirement of `label-interaction`: the double-click
selection guard, clicks passing through, focus forwarding when its target is not labelable,
the popup-trigger rule, and the development warnings.

#### Scenario: Non-labelable target

- **WHEN** a Label has `htmlFor` pointing at a consumer's `div` with `tabIndex=0` and the
  user clicks the Label
- **THEN** the `div` is focused, a development warning is emitted, and the Label renders
  without `for`

### Requirement: Ids

The Label's `id` SHALL be derived through `element-ids` when the consumer passes none, so a
consumer can reference it from `aria-labelledby`, and SHALL be identical on the server and
the client.

#### Scenario: Consumer references the id

- **WHEN** a consumer renders a Label and points a custom element's `aria-labelledby` at
  the Label's `id`
- **THEN** the element's accessible name is the Label's text, and hydration logs no
  mismatch

### Requirement: Data Attributes

The root SHALL carry `data-scope="label"`, `data-part="root"` and `data-instance`.

#### Scenario: Styling hook

- **WHEN** a Label is rendered
- **THEN** it can be selected with `[data-scope="label"][data-part="root"]`

### Requirement: Contract

The Label SHALL ship a contract with scope `label`, anatomy `root`, located by its exact
text, with:

- actions:
  - `click`: a pointer click on the Label's text, replayed as the browser's label
    activation (the forwarded `click` carries `detail` and modifiers). Keyboard declared as
    none, with the reason "a label has no keyboard interaction; keyboard users reach the
    control with Tab".
  - `doubleClick`: two pointer clicks on the Label's text. Keyboard declared as none, with
    the same reason.
- queries: `text`, `controlName` (the accessible name of the element the Label labels, or
  `null`), `isControlFocused`, `selectedText` (the document's selection after an action);
- states: none;
- traits: none.

#### Scenario: Driver in both environments

- **WHEN** a test runs `getLabel(screen, { text: "Email" }).click()` and the same code with a
  Playwright `page`
- **THEN** both resolve with the labelled input focused

#### Scenario: No selection after a double click

- **WHEN** a test runs `doubleClick()` on a Label
- **THEN** `selectedText()` returns `""`

### Requirement: Theme

`@rind-ui/theme` SHALL style the Label through its `data-*` attributes only, in
`label.css`: font and colour from `--rind-label-*` tokens read with semantic fallbacks, a
`cursor` that matches its control (`default` when the control is disabled, through
`:has()` on a disabled descendant or the `control-label`/Field state attributes), and
nothing that changes layout of the control it wraps. The Label belongs to no variant
family: it does not read `data-variant`, and `data-size` only scales its text.

#### Scenario: Stylesheet alone

- **WHEN** a consumer imports `tokens.css` and `label.css` only
- **THEN** a Label renders with the theme's label font and colour

