## MODIFIED Requirements

### Requirement: Anatomy

The Tags Input SHALL consist of: Root, Label, Control (wraps chips, input and buttons),
Chips, Chip, ChipText, ChipRemove, ChipInput (the edit input of a chip), Input,
ClearTrigger (optional) and, when suggestions are used, Positioner, Popup, List, Item,
ItemText, Group (which renders its label), Separator and Empty. The suggestion list parts
(List, Item, ItemText, Group, Separator, Empty) SHALL be add-listbox's reusable listbox parts,
the same ones Combobox uses, under `data-scope="tags-input"`; they SHALL NOT be a copy. Root SHALL render the form carriers of
`hidden-form-input`. Every part SHALL carry `data-scope="tags-input"` and its `data-part`,
and SHALL accept element substitution (`render`) without changing behaviour.

#### Scenario: Minimal tags input

- **WHEN** a consumer renders Root, Label, Control, Chips with a Chip per tag, and Input
- **THEN** tags can be created, navigated and removed with the keyboard and the pointer,
  and a test finds the input by role `textbox` and the label's text

### Requirement: Suggestions

When a `collection` is given, the Tags Input SHALL behave as the `combobox-pattern` input
over it, in one machine: choosing an option (Enter on the highlight, or a press) SHALL
create a tag whose value is the option's key, subject to all checks, clear the draft and
keep the popup open (`closeOnSelect`, default false, the one name the pattern hosts share). A tag whose value is a key in the
collection SHALL show the option's text in its chip and in announcements. Options whose key
is already a tag SHALL be hidden from the results unless `allowDuplicates`. Enter with no
highlight SHALL create a tag from the draft (free text), unless `allowCustom` is false, in
which case it SHALL be refused with reason `invalid`. Chip navigation and removal SHALL
count as inside for the popup's dismissal. Editing a chip SHALL close the popup: focus is in
the chip input, not in the combobox, so the listbox it controls is not shown (APG: a
combobox's popup belongs to its focused input).

#### Scenario: One commit per action (chakra-ui/zag#1661, chakra-ui/ark#2742)

- **WHEN** the user pastes "part", presses Enter, removes the tag and then chooses
  "Partner" from the suggestions
- **THEN** each action changed the value exactly once and the value is ["partner"]

#### Scenario: Remove buttons work with suggestions open (unovue/reka-ui#1579)

- **WHEN** the popup is open and the user presses a ChipRemove
- **THEN** the tag is removed, the popup stays open and the draft is kept
