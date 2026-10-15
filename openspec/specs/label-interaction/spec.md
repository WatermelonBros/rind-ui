# label-interaction Specification

## Purpose
Defines the interaction rules every rind-ui label follows, whether it is the standalone
Label, a control's own Label (`control-label`) or a Field's Label: how a double click on
label text avoids selecting it, why label clicks are never cancelled, how a label reaches a
target that is not labelable, and why a label focuses a popup trigger instead of opening it.
Introduced by `add-label`.
## Requirements
### Requirement: Double-Click Selection Guard

A rind-ui label SHALL prevent the text selection that a double click on its own text
would make. It SHALL do this by cancelling only a `mousedown` whose `detail` is greater
than 1, and only when the press did not start on an interactive descendant (`button`,
`input`, `select`, `textarea`, `a[href]`, or an element with a rind-ui pressable part) and
the event was not already `defaultPrevented`. The consumer's own `onMouseDown` SHALL run
first. A single `mousedown` SHALL never be cancelled.

#### Scenario: Double click on label text (radix#2656)

- **WHEN** the user double-clicks the text of a Label
- **THEN** no text is selected, and the Label's control receives the same activation a
  native label gives it

#### Scenario: Nested input keeps word selection (bits-ui#1323)

- **WHEN** a Label wraps an `<input>` and the user double-clicks a word inside the input
- **THEN** the word is selected

#### Scenario: Nested number spinner (radix#2656)

- **WHEN** a Label wraps an `<input type="number">` and the user clicks its step arrow
  several times quickly
- **THEN** the value steps once per click

#### Scenario: Single click still moves focus (base-ui#586)

- **WHEN** a text input elsewhere is focused and the user presses the mouse once on a
  Label's text
- **THEN** that input blurs, as it would for a native label

#### Scenario: Consumer opts out

- **WHEN** the consumer's `onMouseDown` calls `preventDefault()` on a double click, or
  passes `event.preventRindHandler()`
- **THEN** the label does not apply its own rule a second time

### Requirement: Clicks Pass Through

A rind-ui label SHALL NOT cancel `click` events. Clicks on interactive descendants (links,
buttons) SHALL behave as they do inside a native label, and a `preventDefault()` by a
descendant SHALL stop the label's activation as it does natively.

#### Scenario: Link inside a label (headlessui#3658)

- **WHEN** a Label contains a link to the terms and the user clicks the link
- **THEN** the link navigates and the labelled checkbox does not toggle

#### Scenario: Descendant prevents activation (radix#609)

- **WHEN** a descendant of a Label calls `preventDefault()` in its click handler
- **THEN** the labelled control is not activated

### Requirement: Focus Forwarding For Non-Labelable Targets

When a label's target is not a labelable element (for example a `div` with `role="combobox"`
or `role="radiogroup"`), the label SHALL render without `for`, and a pointer press on it
SHALL focus the target through the shared focus operation, with modality `pointer`. It
SHALL NOT activate the target. The target is named through its own `aria-labelledby`,
which rind-ui controls set themselves (`control-label`, `field-control`).

#### Scenario: Group target

- **WHEN** a Field's Label names a radio group and the user clicks the Label
- **THEN** the group's checked radio (or its first enabled radio) is focused, no selection
  changes, and the label has no `for` attribute (headlessui#3883)

#### Scenario: Substituted label element (base-ui#587)

- **WHEN** a label part is rendered as a `<span>` through `render` and is clicked
- **THEN** its control is focused, and the control's `aria-labelledby` names the span

### Requirement: Labels Focus Popup Triggers

A control whose activation opens a popup (a Select, Combobox, Menu or Date Picker trigger)
SHALL be able to declare that a label-forwarded click only focuses it. For such a control,
a click that the browser forwards from any label (a rind-ui label, a consumer `<label for>`
or a wrapping `<label>`) SHALL focus the control and SHALL NOT open the popup, as a native
`<label>` does for a `<select>`. A label-forwarded click is recognised by the rule
`control-label` already defines (a `pointerdown` on a label whose `control` is the target).

#### Scenario: Select label (headlessui#3787, base-ui#3236)

- **WHEN** the user clicks the label of a closed Select
- **THEN** the Select trigger is focused and the Select stays closed

#### Scenario: Select inside a wrapping label on mobile (radix#3679)

- **WHEN** a Select is wrapped in a `<label>`, opened by a tap, and an option is tapped
- **THEN** the option is selected, the Select closes, and it does not open again

### Requirement: Development Warnings

In development, a rind-ui label SHALL warn once per instance, naming the label's text,
when, after commit, its `for` points at an id that no element has, or at an element that is
not labelable. The warning SHALL say how to fix it (use the control's own Label part, a
Field, or `aria-labelledby` on the control). Production builds SHALL emit nothing.

#### Scenario: For pointing at a div (headlessui#3876)

- **WHEN** a Label has `htmlFor="color"` and the element with id `color` is a `div`
- **THEN** a development warning names the Label and the `div`, and the page renders
  unchanged

