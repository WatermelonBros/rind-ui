## ADDED Requirements

### Requirement: Parent Kinds Through The Opener

A layer MAY declare `parentKinds`, the layer kinds that can be its parent. When it declares
no explicit parent and its parent is found through its opener, the stack SHALL take the
layer holding the opener and walk up its ancestors to the nearest layer whose kind is in
`parentKinds`; when none is, the layer SHALL be a root layer. A layer that declares no
`parentKinds` SHALL keep the opener's holding layer as its parent, as before. The React
adapter's layer context SHALL carry each layer's kind, so a component can find its nearest
enclosing layer of given kinds.

#### Scenario: Dialog opened from a menu item inside a dialog (radix#1836)

- **WHEN** a dialog whose `parentKinds` are the dialog-like kinds is opened from an item of
  a menu that is a child of another dialog
- **THEN** the new dialog's parent is the outer dialog, and closing the menu leaves it open

#### Scenario: No allowed ancestor

- **WHEN** such a dialog is opened from an item of a root menu
- **THEN** it is a root layer

#### Scenario: Without parent kinds

- **WHEN** a layer without `parentKinds` is opened from a menu item
- **THEN** the menu is its parent, as before
