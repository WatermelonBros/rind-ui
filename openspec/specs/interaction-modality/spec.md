# interaction-modality Specification

## Purpose
Defines how rind-ui knows how the user is interacting — keyboard, pointer, touch or
assistive technology — and how that knowledge reaches machines (as the `modality` of
every interaction event) and styling (as `data-focus` and `data-focus-visible`).
## Requirements
### Requirement: Modality Tracking

The environment SHALL track the current interaction modality per window as one of
`keyboard`, `pointer`, `touch` or `virtual`, SHALL let consumers read it and subscribe
to changes, and SHALL work for several documents (iframes) and on the server (where
it reports `keyboard` and never touches globals). A key event SHALL set `keyboard`
only when it is not a modifier-only key, not combined with Meta or Control, and not
combined with Alt on non-Apple platforms. A `pointerdown` with `pointerType` `mouse`
or `pen` SHALL set `pointer`; with `touch` it SHALL set `touch`. Tracking SHALL NOT
patch any built-in prototype.

#### Scenario: Pointer then keyboard

- **WHEN** the user clicks a button and then presses ArrowDown
- **THEN** the modality is `pointer` after the click and `keyboard` after the key

#### Scenario: Switching tabs does not count as keyboard

- **WHEN** the user presses ⌘+Tab or Control alone
- **THEN** the modality does not change

#### Scenario: Server render

- **WHEN** a component renders on the server
- **THEN** the modality is `keyboard` and no `window` or `document` is accessed

### Requirement: Virtual Input Detection

The environment SHALL classify as `virtual`: a `click` with `detail === 0` not
preceded by a pointer or key press on the same element; a `pointerdown` with an
empty `pointerType`; a pointer event with zero width and height, or with width and
height of 1 and zero pressure; and a `focus` event not preceded by a key or pointer
event, excluding the window regaining focus. The UA-specific heuristics among these
SHALL be quirk entries.

#### Scenario: VoiceOver press on a menu trigger (RX#1963)

- **WHEN** VoiceOver activates a trigger with VO+Space in Safari, which dispatches
  `mousedown`, `mouseup` and `click` with `detail: 0` and no pointer events
- **THEN** the activation is classified as `virtual`

#### Scenario: NVDA browse-mode Enter in Firefox (RX#2700)

- **WHEN** NVDA in browse mode activates a trigger and Firefox delivers only a
  `click` with `detail: 0`
- **THEN** the activation is classified as `virtual`

#### Scenario: iOS VoiceOver zero-size pointer events (WebKit 222627, 223202)

- **WHEN** iOS VoiceOver double-taps a control and WebKit dispatches pointer events
  with zero width and height before the `click`
- **THEN** the pointer events are classified as `virtual` and do not set `touch`

#### Scenario: Virtual cursor moves focus (RX#1047)

- **WHEN** the VoiceOver cursor moves onto a tab and the browser fires `focus` with no
  preceding key or pointer event
- **THEN** the focus is classified as `virtual`

#### Scenario: Window refocus

- **WHEN** the user returns to the browser window and the previously focused element
  receives `focus` again
- **THEN** the modality does not change

### Requirement: Modality On Interaction Events

Every event that rind-ui's interaction modules send to a machine (press, long press,
hover, focus, blur, keyboard) SHALL carry a `modality` field typed as the same
`Modality` union contracts use. Guards SHALL be able to read it; rind-ui SHALL export
named guard implementations for `keyboard`, `virtual` and "keyboard or virtual"
modalities that machines can list in `setup`.

#### Scenario: Automatic activation guarded on keyboard

- **WHEN** a machine guards "select on focus" with the exported keyboard-modality guard
  and receives a `FOCUS` event with `modality: "virtual"`
- **THEN** the guard fails and no selection transition is taken

#### Scenario: Virtual open focuses the first item like a keyboard open

- **WHEN** a menu trigger receives a press with `modality: "virtual"`
- **THEN** the machine can take the same "open and focus first item" transition it
  takes for `keyboard`, using the "keyboard or virtual" guard

### Requirement: Focus Attributes

Every focusable part SHALL carry `data-focus` while it has DOM focus and
`data-focus-visible` while it has focus and the modality is not `pointer` or `touch`.
In a text input, typing SHALL NOT turn `data-focus-visible` on after a pointer focus;
only Tab and Escape SHALL — except in an input with role `combobox`, where navigation
keys (arrows, Home, End, PageUp, PageDown) SHALL set the modality to `keyboard`, so the
option they highlight shows its focus ring. A part that is virtually focused (the highlighted item of
an `aria-activedescendant` composite) SHALL carry the same attributes as if it had DOM
focus. Neither attribute SHALL be produced by blurring and re-focusing an element.

#### Scenario: Click then arrow

- **WHEN** the user clicks a listbox option and then presses ArrowDown
- **THEN** after the click the option has `data-focus` and no `data-focus-visible`,
  and after ArrowDown the newly focused option has both

#### Scenario: Text input after a click

- **WHEN** the user clicks into a text input and types letters
- **THEN** the input has `data-focus` and never `data-focus-visible`

#### Scenario: Clicked combobox, then arrows

- **WHEN** the user clicks into a combobox input and presses ArrowDown
- **THEN** the modality becomes `keyboard` and the highlighted option carries
  `data-focus-visible`, while typing letters in that input never does

#### Scenario: Virtually focused option

- **WHEN** a combobox input has DOM focus and ArrowDown highlights an option via
  `aria-activedescendant`
- **THEN** the highlighted option carries `data-focus-visible`

#### Scenario: No blur and refocus (BU#5296)

- **WHEN** the modality changes from `pointer` to `keyboard` while a slider thumb is
  focused
- **THEN** `data-focus-visible` appears without any `blur` or `focus` event on the thumb

### Requirement: Safe Programmatic Focus

rind-ui's own focus moves SHALL go through one focus operation that keeps the current
modality (a focus moved by rind-ui after a key press stays `keyboard`), scrolls the
target into view with the nearest-edge rule (respecting `scroll-padding` and the
reduced-motion preference), and, when the modality is `virtual`, waits for running
transitions on the target before focusing. A consumer's bare `element.focus()` SHALL
count as `virtual`.

#### Scenario: Focus moved after a key

- **WHEN** pressing Enter on a trigger opens a menu and rind-ui focuses its first item
- **THEN** the modality stays `keyboard` and the item has `data-focus-visible`

#### Scenario: Consumer focus

- **WHEN** consumer code calls `focus()` on a rind-ui part with no preceding input
- **THEN** the modality is `virtual` and the part has `data-focus-visible`

### Requirement: Focus Cause

Every focus move made through the safe programmatic focus operation SHALL carry a
cause — `layer` (a layer's initial focus or focus restore), `navigation` (roving,
Tab wrapping, typeahead) or `programmatic` (any other rind-ui move) — and the `FOCUS`
event a machine receives for that element SHALL report it as `cause`, alongside
`modality`. Focus not moved by rind-ui SHALL report `cause: "key"` after a key press,
`"pointer"` after a pointer press, `"window"` when the window regains focus, and
`"other"` otherwise (consumer `focus()`, screen-reader cursor).

#### Scenario: Restore does not look like a user focus

- **WHEN** a dialog closes and rind-ui restores focus to a trigger that also has a
  tooltip
- **THEN** the trigger's `FOCUS` event has `cause: "layer"`, so the tooltip's machine
  can decline to open

#### Scenario: Tab into a trigger

- **WHEN** the user presses Tab and focus lands on a tooltip trigger
- **THEN** the `FOCUS` event has `modality: "keyboard"` and `cause: "key"`

