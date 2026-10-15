# button Specification

## Purpose
Defines rind-ui's Button: a button-like element that reports each activation once, from
every input, with its modality, offers a pending state that keeps focus and announces
itself, and ships a contract and driver for tests.
## Requirements
### Requirement: Button Semantics

Button SHALL follow the `button-like-element` capability. It SHALL be exposed with role
`button` (or `link` when rendered as a link) and SHALL take its accessible name from its
content, or from `aria-label` / `aria-labelledby` for icon-only buttons. A Button whose
accessible name is empty SHALL be reported by the generic name invariant. Button SHALL
forward every attribute of its rendered element, including form attributes (`form`,
`formAction`, `name`, `value`) and `autoFocus`.

#### Scenario: Icon-only button

- **WHEN** a Button containing only an icon is rendered with `aria-label="Close"`
- **THEN** its accessible name is "Close"

#### Scenario: autoFocus forwarded (base-ui#5150)

- **WHEN** a Button is rendered with `autoFocus`
- **THEN** the rendered element has focus after mount

### Requirement: Activation Callbacks

Button SHALL call `onPress` exactly once per activation — pointer click, tap, Enter,
Space, and a bare `click` from assistive technology or tools that dispatch only `click`
— with details carrying the `modality` and the modifier keys. `onPressStart` and
`onPressEnd` SHALL be called when a press starts and ends, including cancelled presses.
A consumer `onClick` SHALL keep receiving the native `click` event. Activation SHALL
happen on release; a press released outside the Button SHALL NOT call `onPress`.

#### Scenario: Screen reader activation (AT note cause A; react-spectrum#10229)

- **WHEN** a Button receives a single `click` with `detail: 0` and no pointer or key
  events before it
- **THEN** `onPress` is called once with `modality: "virtual"`

#### Scenario: Keyboard activation

- **WHEN** Enter is pressed on a focused Button, and later Space is pressed and released
- **THEN** `onPress` is called once for each, with `modality: "keyboard"`

#### Scenario: Press moved off

- **WHEN** the user presses on a Button, moves the pointer off it and releases
- **THEN** `onPressStart` and `onPressEnd` are called and `onPress` is not

#### Scenario: Label forwarding a click (react-spectrum#8887)

- **WHEN** a Button is associated with a `<label>` and the label is clicked
- **THEN** `onPress` is called once in every supported browser

### Requirement: Pending State

A Button with `pending` SHALL stay focusable and keep focus if it had it, SHALL carry
`aria-disabled="true"`, `data-pending` and `data-state="pending"`, and SHALL ignore every
activation. It SHALL NOT set the native `disabled` attribute. Hover and focus events
SHALL still be delivered, so tooltips and similar behaviours on the Button keep
working. A pending Button with `type="submit"` SHALL be rendered with
`type="button"` so neither its own activation nor implicit submission from a text field
submits the form again. When `pending` becomes true while the Button has focus, Button
SHALL make one polite announcement of its `messages.pending` text through the
Announcer; it SHALL make none when it is not focused.

#### Scenario: Focus survives pending (base-ui#4249)

- **WHEN** a focused submit Button becomes pending
- **THEN** focus stays on the Button, it has `aria-disabled="true"` and no `disabled`
  attribute, and one polite announcement "Loading" is made

#### Scenario: Pending ignores presses

- **WHEN** a pending Button is clicked, or Enter or Space is pressed on it
- **THEN** `onPress` is not called and the surrounding form is not submitted

#### Scenario: Tooltip on a pending button (react-spectrum#9460)

- **WHEN** the pointer hovers a pending Button
- **THEN** the Button receives hover (`data-hover` is set) as when it is not pending

#### Scenario: Not focused

- **WHEN** a Button that does not have focus becomes pending
- **THEN** no announcement is made

### Requirement: Button Messages

Button SHALL export typed `messages` with the English default `pending: "Loading"`,
overridable per instance and through the provider.

#### Scenario: Localised pending announcement

- **WHEN** the provider sets Button's `pending` message to "Caricamento"
- **THEN** a focused Button that becomes pending announces "Caricamento"

### Requirement: Button Data Attributes

Button's single part `root` SHALL carry `data-scope="button"`, `data-part="root"`,
`data-instance`, `data-state` (`idle` or `pending`), `data-pending` while pending, and
the shared attributes of `button-like-element` (`data-disabled`, `data-focus`,
`data-focus-visible`, `data-pressed`, `data-hover`). Button SHALL NOT emit attributes
that only mirror a prop with no behaviour (such as a "focusable" flag).

#### Scenario: Styling the pending state

- **WHEN** a Button is pending
- **THEN** its root has `data-state="pending"` and `data-pending`, and loses both when
  pending ends

### Requirement: Button Contract

Button SHALL ship a contract that locates an instance by role `button` (or `link` when
the consumer renders a link) and exact accessible name, with actions `press` (pointer
click, keyboard Enter, touch tap; virtual derived from pointer) and `pressWithSpace`
(keyboard), each completing when the press has ended; and queries `isDisabled`
(`disabled` or `aria-disabled="true"`), `isPending`, `isFocused` and `isFocusVisible`.
The contract SHALL map the machine's `PRESS` event to `press` and observe `idle` and
`pending` through `isPending`. A `getButton` driver SHALL be exported from
`@rind-ui/testing`, and `testMachine` SHALL run Button in every declared modality with
all generic and accessibility invariants.

#### Scenario: Driver in both environments

- **WHEN** a test runs `getButton(screen, { name: "Save" }).press()` and the same test
  runs with a Playwright `page`
- **THEN** the consumer's `onPress` spy is called once in both

#### Scenario: Double activation is caught

- **WHEN** a broken Button calls `onPress` twice for one bare `click`
- **THEN** the virtual-modality run of `testMachine` fails on the virtual activation
  parity invariant

