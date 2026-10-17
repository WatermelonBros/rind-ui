# select Specification

## Purpose
Defines rind-ui's Select: a button-like `combobox` trigger that shows the current value
and opens a listbox popup to choose one or several options — its parts, attributes,
opening, keyboard on the closed trigger and in the popup, selection and closing rules,
value text, validation state, form participation and the contract its driver and
model-based tests are generated from. The options, sections, selection state and
keyboard inside the list are the listbox parts of the `listbox` capability; layering,
dismissal, positioning, collection navigation, typeahead and the hidden form input are
those of the capabilities this builds on and are not restated.
## Requirements
### Requirement: Anatomy

The Select SHALL consist of: `root` (no element), `label` (`span`), `trigger`
(`button`), `value-text` (`span`), `indicator` (`span`), `description` (the
`control-label` Description part), `positioner` (`div`), `content` (`div`), the listbox
parts `list`, `item`, `item-text`, `item-description`, `item-indicator`, `section`,
`section-label`, `separator`, `empty` and `load-more` under `data-scope="select"`, and
`hidden-input`, which the root renders itself after every other part. Only `root`,
`trigger`, `content`, `list` and `item` SHALL be required. Every part SHALL accept the
props of the element it renders and SHALL support element substitution without a change
in behaviour. Content SHALL work the same inline or inside the shared `Portal` part.

#### Scenario: Reado select

- **WHEN** Reado's `atoms/Select.tsx` (trigger with a colour dot, value text and a
  chevron, portal, positioner, content, items with a colour dot and an item text) is
  rewritten with rind-ui parts
- **THEN** it opens, navigates, selects, closes and returns focus, an option whose value
  is `""` can be chosen, and no other change to its markup is needed

### Requirement: Options Are The Listbox Parts

The popup's `list` and everything inside it SHALL be the listbox parts of the `listbox`
capability, with `selectionMode` `single` (default) or `multiple` (`multiple` prop) and
`selectionBehavior` `toggle`, so option roles, names, descriptions, explicit
`aria-selected`, sections, disabled items, the empty state, async loading and
virtualization behave as that capability defines. The Select SHALL add only the rules of
this capability: pointer movement highlights options, a selection may close the popup,
and the list's keyboard map adds Escape and Tab. The popup's `separator` SHALL be the
listbox separator part: `role="none"` (decorative), built with add-separator's shared
`separatorProps` helper in the `listbox` context.

#### Scenario: Selection state in the popup (regression: radix#1907, headlessui#1599, bits-ui#2173)

- **WHEN** an open single select shows "a", "b", "c" with "b" selected and focus on "c"
- **THEN** "b" has `aria-selected="true"`, "a" and "c" `aria-selected="false"`, and "c"
  carries `data-highlighted`

#### Scenario: Separator in the popup (regression: mui/base-ui#5398)

- **WHEN** an open select shows a `separator` between two sections and is checked with axe
- **THEN** the separator has `role="none"` and `aria-required-children` passes

### Requirement: Value And Open State

The selection SHALL be a controllable value (`value`, `defaultValue`,
`onValueChange(value, details)`) of shape `string | null` in single mode and `string[]`
in multiple mode; the empty string SHALL be a valid key distinct from no value. The open
state SHALL be a controllable value (`open`, `defaultOpen`, `onOpenChange(open,
details)`), closed by default. Every open change SHALL carry one of these reasons:
`trigger`, `trigger-key`, `item-select`, `escape-key`, `tab-key`, `outside-press`,
`outside-focus`, `parent-dismissed`, `window-blur` or `api` (programmatic open and
close); every value change one of `select`, `typeahead`, `reset`, `autofill`. Controlled values SHALL only propose
changes.

#### Scenario: No value means no value (regression: ariakit#2516)

- **WHEN** a select without `value` or `defaultValue` receives its items asynchronously
- **THEN** nothing is selected and the placeholder stays shown

#### Scenario: Empty-string option (Reado "built-in" option; regression: radix#2706)

- **WHEN** a select with an option whose value is `""` and label "Default" has the value
  `"a"` and the user chooses "Default"
- **THEN** `onValueChange("", details)` is called once and the value text is "Default"

#### Scenario: Value set before the items arrive (regression: zag#1947, radix#2817)

- **WHEN** a select has `defaultValue="it"` and its collection arrives after the first
  render
- **THEN** the value text shows "Italy" as soon as the collection contains "it", with no
  `onValueChange` call

#### Scenario: Value not in the current items (regression: mui/base-ui#3818, mui/base-ui#5875, kobalte#639)

- **WHEN** a controlled select's value is `"fr"` and the collection is replaced by one
  without "fr"
- **THEN** the value stays `"fr"`, the value text keeps the last known label "France",
  and no change is proposed

### Requirement: Trigger Role, Name And Value

The trigger SHALL be a button-like part with `role="combobox"`, `aria-haspopup="listbox"`
implied by the role and not repeated, `aria-expanded`, and `aria-controls` pointing at
the list only while the list is mounted. It SHALL be named by the `label` part through
`aria-labelledby` while the label is rendered, by the consumer's `aria-label` or
`aria-labelledby`, or natively by a consumer `<label>` wrapping it — and SHALL NOT take
its name from the value text, so its accessible name stays the same when the value
changes. A trigger without a name SHALL produce a development warning. The value text
SHALL be the trigger's content. The trigger SHALL carry `aria-required="true"` when
required, `aria-invalid="true"` when invalid and `aria-describedby` pointing at a
rendered `description`.

#### Scenario: Located by its label in tests (Reado SettingsControls)

- **WHEN** a select labelled "Log level" shows "Info" and a test runs
  `getByRole("combobox", { name: "Log level" })`, then the user picks "Debug" and the
  test runs the same query
- **THEN** both queries return the trigger, and exactly one element matches each time

#### Scenario: Closed list is not referenced

- **WHEN** the select is closed and its content is not mounted
- **THEN** the trigger has `aria-expanded="false"` and no `aria-controls`

#### Scenario: Role on the trigger (regression: bits-ui#2134)

- **WHEN** a select is rendered
- **THEN** its trigger has `role="combobox"` and `aria-expanded="false"`

#### Scenario: Required is announced (regression: react-spectrum#8607, zag#2785)

- **WHEN** a required select is focused by a screen reader
- **THEN** its trigger exposes `aria-required="true"`

### Requirement: Label

The `label` part SHALL be referenced by the trigger's and the list's `aria-labelledby`.
A pointer press on it SHALL focus the trigger without opening the popup, with pointer
modality as `label-interaction` (add-label) defines — so no focus ring — and SHALL do
nothing when the select is disabled. The label SHALL
NOT be associated with the hidden input.

#### Scenario: Label click focuses

- **WHEN** the user clicks the label "Country"
- **THEN** the trigger is focused with `data-focus` but no `data-focus-visible`, and the
  popup stays closed

#### Scenario: Wrapped in a consumer label (regression: radix#3679; Reado Field, "won't open under happy-dom")

- **WHEN** the select's trigger is inside a consumer `<label>` and the user clicks the
  trigger once, in a browser, in jsdom and in happy-dom
- **THEN** the popup opens and stays open, and clicking the label's own text focuses the
  trigger without opening it (Label Activation Focuses The Trigger)

### Requirement: Opening From The Trigger

A press on the trigger SHALL toggle the popup on activation (release), for mouse, pen,
touch and keyboard, and for a bare `click` sent by assistive technology; a pointer
press-down alone SHALL NOT open it, and a press moved off the trigger before release
SHALL NOT open it. A touch that turns into a scroll SHALL NOT open it. Enter, Space,
ArrowDown, ArrowUp and Alt+ArrowDown on the focused trigger SHALL open a closed popup.
While the popup is open the trigger SHALL count as inside it, so pressing it closes the
popup with reason `trigger` and never closes and re-opens it. A disabled or
read-only select SHALL NOT open.

#### Scenario: VoiceOver press

- **WHEN** VoiceOver activates the trigger with VO+Space in Safari (a `click` with
  `detail: 0` and no pointer or key events)
- **THEN** the popup opens with the selected option focused

#### Scenario: Scrolling over the trigger on a phone (regression: radix#1641, headlessui#3757)

- **WHEN** a touch starts on the trigger and turns into a page scroll
- **THEN** the popup does not open

#### Scenario: Tap does not reach the option under the finger (regression: radix#1658, bits-ui#1108, headlessui#3750)

- **WHEN** a touch user taps the trigger and the popup opens with an option under the
  finger
- **THEN** no option is selected and the popup stays open

#### Scenario: Under a test user-event (regression: radix#1822, headlessui#3703)

- **WHEN** a Testing Library test with `@rind-ui/testing/setup` runs
  `userEvent.click(trigger)` and, separately, focuses the trigger and presses Enter
- **THEN** the popup opens in both cases, in jsdom and in happy-dom

### Requirement: Initial Focus And Scroll On Open

When the popup opens, after its first placement, focus SHALL move to the selected
option (the first selected one in collection order in multiple mode), scrolled so that it
is centred in the list's visible area when the list scrolls, without smooth scrolling and
without scrolling the page; with no navigable selected option
it SHALL move to the last navigable option when opened with ArrowUp and to the first
otherwise; with no navigable option, to the list. The focused option SHALL be
highlighted; it SHALL carry `data-focus-visible` only when the popup was opened with the
keyboard. In a virtualized select the scroll SHALL go through the scroll-to-index
callback with reason `open`. Initial focus SHALL run once per open; items arriving later
SHALL NOT move focus again. The key that opened the popup SHALL NOT select the option
that receives focus.

#### Scenario: Long list with a selection far down (regression: react-spectrum#3910, react-spectrum#9031, bits-ui#1712, ariakit#7011, radix#2369)

- **WHEN** a select of 200 countries with "Italy" (item 108) selected is opened with the
  mouse
- **THEN** "Italy" is centred in the list's visible area, focused and highlighted, and the
  page did not scroll

#### Scenario: Arrow keys open, never change the value (regression: mui/base-ui#5633)

- **WHEN** a closed select with the value "b" is focused and the user presses ArrowDown
- **THEN** the popup opens with "b" focused and the value is still "b"

#### Scenario: ArrowUp with no value

- **WHEN** a select with no value is focused and the user presses ArrowUp
- **THEN** the popup opens with the last option focused

#### Scenario: Enter does not select

- **WHEN** the user opens the popup with Enter
- **THEN** the selected option is focused and `onValueChange` was not called

### Requirement: Typeahead On The Closed Trigger

In single mode, a printable character typed on the focused, closed trigger SHALL run the
shared typeahead over the whole collection, starting after the selected option, and
SHALL select the match without opening the popup (reason `typeahead`), skipping disabled
options. Space SHALL join a search in progress instead of opening the popup. No match
SHALL leave the value unchanged. In multiple mode, typing on the closed trigger SHALL do
nothing. A closed select mounts no option, so the collection searched before the first
open is the data collection (`items` or `collection`); options declared only as mounted
parts register while the popup is open. The search buffer SHALL be reset when the popup opens or closes, on blur and when
the value is reset.

#### Scenario: Pick by typing (native select behaviour; regression: reka-ui#2292)

- **WHEN** a closed select of countries is focused and the user types "s", "p"
- **THEN** the value becomes "Spain", the popup stays closed, and `onValueChange` was
  called once per changed match

#### Scenario: Disabled match on the closed trigger (regression: mui/base-ui#5776, ark#3601)

- **WHEN** the user types the first letter of a disabled option on the closed trigger
- **THEN** the value does not change to that option

#### Scenario: Space continues a search (regression: react-spectrum#851)

- **WHEN** the user types "New", Space, "Z" on the closed trigger
- **THEN** "New Zealand" is selected and the popup did not open

#### Scenario: Reset after a value reset (regression: mui/base-ui#2608)

- **WHEN** a search "b" is in progress, the form is reset, and the user types "b"
- **THEN** the first option starting with "b" is selected, not the second

### Requirement: Keyboard In The Popup

Inside the open popup the listbox keyboard map SHALL apply, with these Select rules:
ArrowDown and ArrowUp SHALL NOT wrap (`loop` false by default); printable characters
SHALL use the shared typeahead and only move the highlight; in single mode Enter and
Space SHALL select the focused option, close the popup and focus the trigger; in
multiple mode Enter and Space SHALL toggle the focused option and keep the popup open;
Escape SHALL close the popup without changing the value, focus the trigger and call
`preventDefault()`; Tab and Shift+Tab SHALL close the popup without changing the value
and move focus to the element after, respectively before, the trigger in sequential
focus order. Key handling SHALL act only on events whose target is the list or one of its
options, and SHALL ignore IME composition.

#### Scenario: Choose with the keyboard

- **WHEN** the user opens a single select with ArrowDown, presses ArrowDown twice and
  Enter
- **THEN** the option two below the previously selected one is the value, the popup is
  closed and the trigger is focused

#### Scenario: Escape inside a dialog

- **WHEN** a select inside a modal dialog is open and the user presses Escape
- **THEN** only the select closes and the trigger is focused; a second Escape closes the
  dialog

#### Scenario: Tab out

- **WHEN** a portalled select is open and the user presses Tab
- **THEN** the popup closes, the value is unchanged, and focus is on the element that
  follows the trigger

#### Scenario: Multiple stays open (regression: headlessui#3765, reka-ui#2954, bits-ui#2049)

- **WHEN** in a multiple select the user presses Space on "a" and on "c", and clicks "d"
- **THEN** "a", "c" and "d" are selected, each press toggled exactly once, and the popup
  is still open

#### Scenario: Space does not scroll the page (regression: kobalte#567)

- **WHEN** the user presses Space, PageDown and End in an open select on a long page
- **THEN** the list handles each key and the page does not scroll

### Requirement: Pointer In The Popup

Real mouse or pen movement over a navigable option SHALL highlight and focus it without
scrolling, except while a keyboard or typeahead session is active (the shared pointer
guard). Touch SHALL never highlight by hover. A press (release) on an enabled option
SHALL select it and, in single mode, close the popup and focus the trigger; in multiple
mode toggle it and keep the popup open. A touch press that becomes a scroll of the list
SHALL NOT select. A press on a disabled option, a section label or a separator SHALL do
nothing and keep the popup open. A closing popup SHALL NOT react to pointer movement.

#### Scenario: Keyboard scroll under a resting mouse (regression: zag#3255)

- **WHEN** the mouse rests over the list and the user presses ArrowDown until the list
  scrolls
- **THEN** the keyboard highlight stays where it is

#### Scenario: Scrolling the list with a finger

- **WHEN** a touch user drags the open list to scroll it and lifts the finger over an
  option
- **THEN** no option is selected and the popup stays open

#### Scenario: Touch screen reader (regression: radix#1343)

- **WHEN** iOS VoiceOver activates the trigger and the popup opens
- **THEN** the popup stays open until the user activates an option or dismisses it

### Requirement: Closing Rules

The popup SHALL close, keeping the value unless a selection caused it, on: a single-mode
selection (`item-select`), Escape, Tab, a press outside every layer of the select
(`OUTSIDE_PRESS`), focus moving outside when not modal (`OUTSIDE_FOCUS`), the window
losing focus (`WINDOW_BLUR`) and a trigger press. On close, focus SHALL return to the
trigger by the overlay's restore rule, except after Tab and window blur. The highlight
SHALL be cleared on close.

#### Scenario: Outside click does not activate what is underneath

- **WHEN** a modal select is open and the user clicks a button on the page
- **THEN** the popup closes, the button is not activated, and the trigger is focused

#### Scenario: Switching applications

- **WHEN** the window loses focus while the popup is open
- **THEN** the popup closes with reason `window-blur` and focus is not moved

### Requirement: Modal By Default

The popup SHALL be a layer of kind `listbox`, modal unless `modal={false}`: everything
outside it, its descendant layers, its trigger and its label SHALL be inert and page
scrolling locked, as the overlay capabilities specify, so that the list's
`aria-labelledby` resolves in every engine. With `modal={false}` nothing SHALL be inert
and scrolling SHALL NOT be locked.

#### Scenario: List name in Chromium (regression: react-spectrum#9737)

- **WHEN** a modal select labelled "Country" is open in Chromium and the accessibility
  tree is read
- **THEN** the listbox is named "Country"

#### Scenario: Select inside a dialog (regression: ark#3728, kobalte#621)

- **WHEN** a select opened from inside a modal dialog renders its popup in a portal
- **THEN** the popup is not inert and fully interactive, and it opens again after being
  closed

### Requirement: List Name

The list SHALL be named by the `label` part when rendered; otherwise, when the trigger
has a consumer `aria-label`, the list SHALL carry the same `aria-label`; otherwise by a
consumer `aria-labelledby` on the trigger. The list SHALL NOT be named by the trigger
element itself, whose name computation would return the selected value.

#### Scenario: Icon-only select with aria-label

- **WHEN** a select's trigger has `aria-label="Sort by"` and no label part
- **THEN** its listbox is named "Sort by", not by the selected option's text

### Requirement: Value Text And Placeholder

The `value-text` part SHALL render, from collection data and with no option mounted, the
selected option's text value in single mode and the selected text values joined with the
locale's list format in multiple mode; when nothing is selected it SHALL render the
`placeholder` prop. Consumers SHALL be able to render the value text themselves from the
selected items. When the value changes, the text node SHALL be replaced rather than
updated in place. The trigger and the value text SHALL carry `data-placeholder` while the
placeholder is shown.

#### Scenario: Closed select mounts no options (regression: radix#2602, ark#3021, reka-ui#1985, react-spectrum#8722)

- **WHEN** a closed select of 2,000 options has the value "it"
- **THEN** the value text is "Italy", no option element is in the document, and no hidden
  `<option>` exists

#### Scenario: Safari reads the new value (regression: zag#3099, radix#3671)

- **WHEN** the value changes from "Banana" to "Cherry" while VoiceOver is on the trigger
  in Safari
- **THEN** the value text element is a new node containing "Cherry"

#### Scenario: Multiple value text

- **WHEN** a multiple select for locale `en` has "Apple", "Pear" and "Plum" selected
- **THEN** the value text is "Apple, Pear, and Plum"

### Requirement: Disabled, Read-Only, Required And Invalid

A `disabled` select SHALL NOT be a Tab stop unless `focusableWhenDisabled`, SHALL NOT
open and SHALL ignore typeahead; its hidden input SHALL be disabled (submitting nothing).
A `readOnly` select SHALL be focusable, SHALL NOT open and SHALL ignore typeahead, and
its value SHALL still be submitted. `required` SHALL set `aria-required` on the trigger
and the native constraint on the hidden input. `invalid` SHALL set `aria-invalid` on the
trigger. Every part SHALL carry the matching `data-disabled`, `data-readonly`,
`data-required` and `data-invalid`.

#### Scenario: Disabled fieldset (regression: radix#2417)

- **WHEN** a select is inside a `<fieldset disabled>`
- **THEN** its trigger is disabled, it does not open, and its hidden input submits
  nothing

#### Scenario: Read-only

- **WHEN** a read-only select is focused and the user presses ArrowDown and types "b"
- **THEN** the popup stays closed and the value is unchanged

### Requirement: Form Participation Without A Native Select

The Select SHALL take part in forms through the `hidden-form-input` capability with one
visually hidden native `<input>` (not a `<select>`), `aria-hidden="true"`, `tabIndex=-1`,
no associated label and no options: its `value` SHALL be the selected key in single mode
(empty when none), its `name`, `form`, `required`, `disabled` and `autocomplete` SHALL
mirror the props, and in multiple mode one additional `<input type="hidden" name>` per
selected key SHALL carry the values while the visually hidden input carries the
constraint. User selections SHALL dispatch one bubbling `input` and one `change` from the
hidden input; programmatic changes SHALL dispatch none; form reset SHALL restore the
default value with reason `reset`; native validation focus SHALL land on the trigger.
The component SHALL render no element that duplicates the trigger's role, its name, the
label's text or any option's text.

#### Scenario: Role and text queries find one element (Reado SettingsControls, Ark's own Select test, radix#3294)

- **WHEN** a named select inside a form shows "Info", and a test runs
  `getAllByRole("combobox")`, `getAllByText("Info")` and `getAllByLabelText("Log level")`
- **THEN** each returns exactly one element: the trigger, the value text and the trigger

#### Scenario: Native submission (regression: headlessui#3751, react-spectrum#8511)

- **WHEN** a form contains a single select `name="country"` with value "it" and a
  multiple select `name="tags"` with "a" and "c"
- **THEN** the form data is `country=it`, `tags=a`, `tags=c`, also when read in a mount
  effect before any interaction

#### Scenario: Always rendered (regression: react-spectrum#10642, reka-ui#2572)

- **WHEN** selects with and without `name`, inside and outside a form, with 5 and 2,000
  options are rendered
- **THEN** each renders the same single visually hidden input, and each returns to its
  default value when its form is reset

#### Scenario: Form reset (regression: radix#3089)

- **WHEN** an uncontrolled select with `defaultValue="a"` is changed to "c" and its form
  is reset
- **THEN** the value text is the label of "a" and `onValueChange` was called with
  `details.reason === "reset"`

#### Scenario: Change events for user changes only (regression: radix#4102)

- **WHEN** a parent changes a controlled select's value, and later the user chooses an
  option
- **THEN** the hidden input dispatched no event for the first change and exactly one
  `input` and one `change` for the second

#### Scenario: No scroll overflow (regression: radix#3875, bits-ui#1987, ark#2741)

- **WHEN** a select is rendered at the bottom of a fixed-height scroll container in a
  `100dvh` layout and its label is clicked
- **THEN** neither the container's nor the document's scroll size or position changes

#### Scenario: Required blocks submission (regression: react-spectrum#1634, react-spectrum#8034, bits-ui#1807, reka-ui#1872)

- **WHEN** a required select with no value and no `name`, one of 2,000 options, is
  submitted in a form, and when a required multiple select with two values is submitted
- **THEN** the first submission is cancelled and the second succeeds; for the first the hidden input reports `validity.valueMissing`, and
  focus is on the trigger with `data-focus-visible`

### Requirement: Browser Autofill

When the browser or a password manager writes a value into the hidden input, the Select
SHALL adopt it as a user change with reason `autofill`: the key equal to the written value
or, failing that, the option whose text value equals it under the locale's search
collator; in multiple mode autofill SHALL be ignored. An unmatched value SHALL leave the
selection unchanged and the hidden input re-synced. After an autofill the trigger SHALL
carry `data-autofill` until the next user change. Focus moved to the hidden input by an
extension SHALL be forwarded to the trigger.

#### Scenario: Country autofill (regression: zag#2956, react-spectrum#7660)

- **WHEN** a select with `autocomplete="country-name"` and an option "it" / "Italy" is
  autofilled with "italy"
- **THEN** `onValueChange("it", details)` is called once with `details.reason ===
  "autofill"` and the trigger carries `data-autofill`

### Requirement: Positioning

The positioner SHALL use the `dropdown` positioning preset, overridable by `positioning`
props, and SHALL expose the positioning contract fragment and `--rind-anchor-width` so
the popup can match the trigger's width. The popup SHALL NOT be positioned to align the
selected option with the trigger.

#### Scenario: Trigger at the bottom of the viewport

- **WHEN** the trigger sits 40 px above the bottom edge and the popup does not fit below
- **THEN** the popup is placed above and carries `data-side="top"`

### Requirement: Mounting

Content SHALL NOT be mounted before the select first opens and SHALL be unmounted after
its exit animation; with `keepMounted` it SHALL stay mounted, hidden and inert while
closed, holding no layer. A closed select SHALL do no positioning work and SHALL mount no
option to compute its value text or form value.

#### Scenario: Lazy options

- **WHEN** a select's options are fetched in `onOpenChange(true)` and arrive after
  opening
- **THEN** the first option arriving is focusable by ArrowDown and initial focus did not
  run again

### Requirement: Announcements

The Select SHALL NOT announce anything through the announcer; focus movement carries
option names and states, and the trigger's value text carries the closed-trigger
typeahead result.

#### Scenario: Navigating

- **WHEN** the user opens a select and arrows through it with a recording announcer
- **THEN** the announcement log is empty

### Requirement: Data Attributes

Every part SHALL carry `data-scope="select"`, `data-part` (its part name) and
`data-instance`; the listbox parts SHALL carry the attributes the `listbox` capability
defines. Additionally:

- `trigger`: `data-state` (`open` | `closed`), `data-placeholder`, `data-autofill`,
  `data-focus`, `data-focus-visible`, `data-pressed`, `data-disabled`, `data-readonly`,
  `data-required`, `data-invalid`.
- `value-text`: `data-placeholder`.
- `indicator`: `data-state`; `aria-hidden`.
- `positioner`: placement attributes (`data-side`, `data-align`, `data-anchor-hidden`,
  `data-placing`) and layer metadata.
- `content`: `data-state`, `data-side`, `data-align`, `data-placing`, `data-modal` when
  modal, `data-close-reason` (kebab case) from close until the next open.
- `label`, `description`: `data-disabled`, `data-readonly`, `data-required`,
  `data-invalid`.
- `hidden-input`: `data-part="hidden-input"` only.

#### Scenario: Styling the open trigger

- **WHEN** the select is open with no value and a placeholder
- **THEN** the trigger carries `data-state="open"` and `data-placeholder`

### Requirement: Select Contract

The `select` contract SHALL locate an instance by its trigger's role `combobox` and exact
accessible name, include the collection and positioning contract fragments, and declare
the traits `disclosure`, `layer`, `restores-focus`, `presence`, `anchored`,
`composite-roving`, `selectable` and `form-associated`, plus `modal` when modal. It SHALL
declare the actions `open` (pointer, touch, keyboard Enter), `openWithArrowUp`, `close`
(Escape), `choose(name)` (opening first when closed; pointer press or arrows and Enter),
`toggle(name)` (multiple), `typeahead(text)` (in the open list), `typeaheadClosed(text)`
(on the closed trigger; postcondition: value changed, popup closed), `pressOutside`,
`tabOut`, `pressEscape`, `pressLabel` and `openWithArrowDown`, each with a postcondition
(a form reset is exercised by the form tests: the environment abstraction has no form
operation), and the queries `isOpen`, `value`
(the value text), `selected`, `items`, `highlighted`, `focusedItem`, `isPlaceholder`,
`isDisabled`, `isInvalid`, `isRequired`, `formValue` (the hidden inputs' values) and
`closeReason`. Programmatic `OPEN`/`CLOSE`, `WINDOW_BLUR` and autofill SHALL map to
`{ skip: reason }`; `$sync:open` SHALL map to a prop step and `$sync:value` to a skip (a
controlled value moves no state of the graph). The contract SHALL declare which
controllable values the form carries (`value`), so a step changing only `open` is not a
user change of the form's value.

#### Scenario: Driver round trip

- **WHEN** a test runs `const s = getSelect(screen, { name: "Country" })`, then
  `await s.choose("Italy")` and `await s.via("keyboard").typeaheadClosed("sp")`
- **THEN** each action resolves after its postcondition, `await s.value()` is "Spain",
  `await s.formValue()` is `["es"]` and `await s.isOpen()` is false

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged and no lookup matched a hidden element

### Requirement: Model-Based Coverage

`testMachine` over the select contract SHALL cover every transition in every declared
modality including `virtual` and `touch`, with props classes `{ multiple: false }`,
`{ multiple: true }`, `{ modal: false }`, `{ required: true }` inside a form, and the
collection argument classes, and SHALL pass every generic, accessibility, collection,
overlay, layout and form invariant.

#### Scenario: Wrapper names the trigger by its value

- **WHEN** a consumer wrapper sets the trigger's `aria-labelledby` to the value text and
  runs `testMachine`
- **THEN** the step after a selection fails because the trigger's name changed and the
  driver can no longer locate it by its label

### Requirement: Label Activation Focuses The Trigger

The trigger SHALL declare the press option `labelActivation: "focus"` (add-a11y-foundations
`press-interactions`, following add-label's `label-interaction` "Labels Focus Popup
Triggers"). A click that the browser forwards to the trigger from any label (the Field's
Label, a consumer `<label for>` or a wrapping `<label>`) SHALL focus the trigger and SHALL
NOT open the popup, as a native `<label>` does for a `<select>` (radix#3679,
headlessui#3787). A direct press on the trigger SHALL still open it.

#### Scenario: Label click focuses the trigger and does not open it (headlessui#3787)

- **WHEN** a closed Select's trigger is referenced by a `<label for>` and the user clicks
  the label's text
- **THEN** the trigger is focused and the popup stays closed

#### Scenario: Wrapping label on mobile (radix#3679)

- **WHEN** a Select is wrapped in a `<label>`, opened by a tap on the trigger, and an
  option is tapped
- **THEN** the option is selected, the popup closes, and it does not open again

### Requirement: Field Control Binding

The Select SHALL implement add-field's `field-control` binding. Its Root SHALL read the
nearest Field's binding and register the Select with that Field exactly once (trigger id, labelable trigger,
focus operation on the trigger, the hidden constraint input as validity element, a reader
for the value), unregistering on unmount. Its typeahead and list SHALL NOT receive the
Field's wiring.
The Field's ARIA SHALL be applied only to the registered trigger: `aria-describedby`
with the Field's Description and, while rendered, ErrorMessage ids; `aria-invalid` only
where field-control's role rule allows it on the trigger (the error in
`aria-describedby` and `data-invalid` always carry the state, react-spectrum#8382);
`aria-required` from the Field.
Its `disabled`, `readOnly`, `required` and `invalid` SHALL be OR-merged with the Field's
and an enclosing Fieldset's (field-control "State Propagation"). It SHALL report each
accepted change and each commit (closing the popup is a commit) exactly once (field-control "Reporting Changes"), register a focus
target that focuses the trigger, never the hidden input (base-ui#2113), declare the `field-associated` trait, and add the Field prop × control
matrix test.

#### Scenario: Select in an invalid, required Field

- **WHEN** a Select with no props of its own is inside a required Field that displays an
  error
- **THEN** its trigger has `aria-required="true"`, its accessible description contains the
  error, it carries `data-invalid` and `data-required`, and its hidden input is `required`

#### Scenario: Closing reports a commit

- **WHEN** the user opens a Select inside a Field in `blur` mode and closes it with Escape
  without changing the value
- **THEN** the Select reports one commit and no change to the Field

