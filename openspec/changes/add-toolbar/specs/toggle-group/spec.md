## ADDED Requirements

### Requirement: Hosted By A Toolbar

When a `CompositeHost` (add-toolbar's `composite-host` capability) is present, the Toggle
Group SHALL run in hosted mode instead of its own keyboard and tab-stop rules: its items
SHALL register with the host and join the host's roving focus in document order; the
group SHALL render no tab stop of its own, SHALL handle no arrow, Home or End keys and
SHALL not wrap at its own ends (the "tab stop is always an item" rule is the host's);
the host's `disabled` and `focusableWhenDisabled` SHALL apply to its items. It SHALL keep
role `group`, `aria-pressed` on its items, its name, its value and its change callbacks,
and Enter, Space and presses SHALL still press items. A toggle group inside a popup or
portal opened from a host control SHALL be standalone.

#### Scenario: Toggle group stays toggle buttons in a toolbar (regression: radix-ui/primitives#4119)

- **WHEN** a single-mode toggle group (Bold, Italic) sits between "Undo" and "Link" in a
  toolbar and focus is on "Undo"
- **THEN** ArrowRight three times focuses Bold, Italic, then Link; the items keep
  `aria-pressed` and the root keeps role `group`

#### Scenario: No callback from hosting (regression: huntabyte/bits-ui#446)

- **WHEN** a toolbar with a controlled multiple toggle group mounts and the user presses
  one item
- **THEN** `onValueChange` is called exactly once and exactly one control of the toolbar
  has `tabIndex=0`
