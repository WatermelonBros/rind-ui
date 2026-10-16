## MODIFIED Requirements

### Requirement: Parent Layer

A dialog SHALL be the child of the nearest open dialog-like layer (`dialog`,
`alertdialog`, `drawer` or `popover`) among its logical ancestors — the layer whose content
contains its root, or else its trigger — and SHALL be a root layer otherwise. A popover is a
parent, so a dialog opened from a popover keeps the popover open and focus returns into it
(zag#2933). Menus, selects and tooltips SHALL NOT be the parent of a dialog, so a dialog opened
from inside one of them survives that layer closing (radix#1836).

#### Scenario: Dialog opened from a drawer

- **WHEN** a confirmation dialog is opened from a button inside an open drawer
- **THEN** the dialog is the drawer's child layer: Escape closes only the dialog, and
  closing the drawer closes the dialog first with reason `PARENT_DISMISSED`; stacking
  families stay separate (the drawer is not counted as a nested dialog)

#### Scenario: Dialog rendered inside a menu item

- **WHEN** a dialog's root is rendered inside a menu item, the item is activated, and
  the menu closes and unmounts its items
- **THEN** the dialog stays open and usable, and the page has no `pointer-events` or
  inert left over after it closes (regression: radix#1836, radix#3317, radix#3462)

#### Scenario: Dialog opened from a popover inside a dialog

- **WHEN** dialog A opens a popover, the popover opens dialog B, and B is closed with
  its close trigger
- **THEN** only B closes; A and the popover stay open (regression: zag#2933)

#### Scenario: Dialog opened from a popover

- **WHEN** a dialog is opened from a button inside an open popover and takes focus
- **THEN** the dialog is the popover's child layer: the popover stays open while the dialog
  has focus, and after the dialog closes focus returns to the button inside the popover
