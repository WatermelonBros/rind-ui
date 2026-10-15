## Purpose

Defines how a composite component (Toggle Group, Radio Group, and later Tabs or
Segmented Control) behaves when it is placed inside an enclosing composite that owns
focus navigation, such as a Toolbar: whose items are navigated, who owns the tab stop
and the arrow keys, and what the hosted component keeps.

## ADDED Requirements

### Requirement: Host Detection

A composite host (the Toolbar) SHALL make itself available to the components rendered
inside it, with its orientation, direction, loop setting and disabled state. A composite
component that supports hosting SHALL detect the nearest host when it mounts and on the
server, so the server render already reflects hosting. A component inside a popup or
portal opened from a host control SHALL NOT be hosted by it.

#### Scenario: Server render inside a toolbar

- **WHEN** a toolbar containing a toggle group is server-rendered
- **THEN** the HTML gives exactly one control in the whole toolbar `tabIndex=0`

#### Scenario: Radio group in a popover

- **WHEN** a radio group is rendered inside a popover opened from a toolbar control
- **THEN** it is a standalone radio group with its own tab stop and arrow keys

### Requirement: Hosted Items Join The Host

When hosted, every item of the component SHALL be a control of the host, in document
order among the host's other controls. The host SHALL own the tab stop and the arrow
keys for all of them: the hosted component SHALL render no tab stop of its own, SHALL
not handle navigation keys, SHALL not wrap at its own ends, and its items' `tabIndex`,
`data-highlighted` and focus SHALL follow the host. Navigation SHALL cross the hosted
component's boundary in both directions.

#### Scenario: Arrow through a toggle group

- **WHEN** a toolbar holds "Undo", a toggle group (Bold, Italic) and "Link", and focus is
  on "Undo"
- **THEN** ArrowRight three times focuses Bold, Italic, then Link

#### Scenario: One tab stop overall

- **WHEN** a toolbar holds two hosted groups and three buttons
- **THEN** exactly one of the seven controls has `tabIndex=0`

### Requirement: Hosted Components Keep Semantics And Values

A hosted component SHALL keep its role, its name, its value and its change callbacks,
and SHALL change its value only through its own activation keys and presses — never
through hosting, mounting or host navigation. Hosting SHALL fire no change callback.

#### Scenario: No callback on mount

- **WHEN** a toolbar with a controlled multiple toggle group mounts and the user presses
  one item
- **THEN** `onValueChange` is called exactly once (regression: huntabyte/bits-ui#446)

#### Scenario: Toggle group stays toggle buttons

- **WHEN** a single-mode toggle group is hosted by a toolbar
- **THEN** its items are buttons with `aria-pressed` and its root is a `group`
  (regression: radix-ui/primitives#4119)

### Requirement: Radio Group In A Host

A hosted Radio Group SHALL keep role `radiogroup` with `radio` items and `aria-checked`.
Moving focus onto or across its radios SHALL never check one; Space and Enter SHALL
check the focused radio. Its arrow keys SHALL be the host's (see Hosted Items Join The
Host).

#### Scenario: Move without checking

- **WHEN** "Left" is checked in a hosted alignment radio group and the user arrows onto
  "Center" and "Right"
- **THEN** "Left" is still checked, and pressing Enter on "Right" checks it (regression:
  radix-ui/primitives#2146, kobaltedev/kobalte#579)

#### Scenario: Screen reader cursor

- **WHEN** the VoiceOver cursor moves focus onto a hosted radio without a key press
- **THEN** no radio is checked

### Requirement: Disabled From The Host

A host's `disabled` state, and a host group's, SHALL disable every hosted item in
addition to the component's own `disabled`. The host's `focusableWhenDisabled` SHALL
apply to hosted items unless the hosted component sets its own.

#### Scenario: Disabled toolbar

- **WHEN** a toolbar is disabled
- **THEN** every item of its hosted toggle group has `aria-disabled="true"` and pressing
  one changes nothing
