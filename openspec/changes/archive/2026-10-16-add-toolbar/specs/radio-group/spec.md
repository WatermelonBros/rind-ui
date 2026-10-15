## ADDED Requirements

### Requirement: Hosted By A Toolbar

When a `CompositeHost` (add-toolbar's `composite-host` capability) is present, the Radio
Group SHALL run in hosted mode instead of the standalone keyboard and tab-stop rules:
its radios SHALL register with the host and join the host's roving focus in document
order; the group SHALL render no tab stop of its own (no fallback `tabIndex` on the root)
and SHALL handle no arrow, Home or End keys; the host's `disabled` and
`focusableWhenDisabled` SHALL apply to its radios. It SHALL keep role `radiogroup`, its
`radio` items, `aria-checked`, its name, its value and its change callbacks. A hosted
radio group SHALL never check a radio on arrow movement or focus; Space and Enter SHALL
check the focused radio (Enter does not submit the form while hosted). A radio group
inside a popup or portal opened from a host control SHALL be standalone.

#### Scenario: Arrows only move inside a toolbar (regression: radix-ui/primitives#2146, kobaltedev/kobalte#579)

- **WHEN** "Left" is checked in an alignment radio group inside a toolbar and the user
  presses ArrowRight twice from "Left"
- **THEN** focus is on "Right", "Left" is still checked and no change callback fired;
  pressing Enter then checks "Right" once

#### Scenario: No own tab stop when hosted

- **WHEN** a toolbar holds a button and a hosted radio group with three radios
- **THEN** exactly one of the four controls has `tabIndex=0`, and the group root has no
  `tabIndex`
