## Purpose

Defines the rind-ui Tags Input: a text input whose typed or pasted text becomes a list of
string tags — creation by Enter and delimiters, paste splitting, IME safety, validation,
duplicates, maximum, blur behaviour, editing a tag in place, optional suggestions, form
participation, parts, `data-*` attributes, messages and the contract. Chip display,
navigation and removal come from the shared `input-chips` behaviour of `add-combobox`;
suggestions come from `combobox-pattern`. Follow-up (not yet delivered, tracked in docs/review-backlog.md): the
Suggestions requirement and the suggestion parts, delivered with the extraction of the
`combobox-pattern` pieces shared with Autocomplete. Root renders no element of its own: the
form carriers are rendered by the Control and the machine state is the Control's
`data-state`.

## ADDED Requirements

### Requirement: Anatomy

The Tags Input SHALL consist of: Root, Label, Control (wraps chips, input and buttons),
Chips, Chip, ChipText, ChipRemove, ChipInput (the edit input of a chip), Input,
ClearTrigger (optional) and, when suggestions are used, Positioner, Popup, List, Item,
ItemText, Group, GroupLabel, Separator and Empty. Root SHALL render the form carriers of
`hidden-form-input`. Every part SHALL carry `data-scope="tags-input"` and its `data-part`,
and SHALL accept element substitution (`render`) without changing behaviour.

#### Scenario: Minimal tags input

- **WHEN** a consumer renders Root, Label, Control, Chips with a Chip per tag, and Input
- **THEN** tags can be created, navigated and removed with the keyboard and the pointer,
  and a test finds the input by role `textbox` and the label's text

### Requirement: Values

The Tags Input SHALL have two controllable values following the machine runtime's
controllable semantics: `value` (`string[]`, the tags in order) and `inputValue` (the
draft text). Each change callback SHALL fire once per user action with a reason (`enter`,
`delimiter`, `paste`, `blur`, `suggestion`, `edit`, `chip-remove`, `backspace`, `clear`,
`reset`, `input-change`). A parent refusing a `value` proposal SHALL leave the tags and the
draft as the parent's state says; the draft SHALL NOT be cleared by a refused creation.
Tags SHALL be identified by a key derived from the value (the value itself, or the value
plus its occurrence number when duplicates are allowed), never by an index.

#### Scenario: Refused creation keeps the draft

- **WHEN** a controlled Tags Input whose parent ignores `onValueChange` has the draft
  "rome" and the user presses Enter
- **THEN** no chip appears and the input still shows "rome"

#### Scenario: One callback per paste

- **WHEN** the user pastes "a, b, c"
- **THEN** `onValueChange` fires once with `["a", "b", "c"]` and reason `paste`

### Requirement: Roles And Relations

Without suggestions the Input SHALL be a native `<input type="text">` with its implicit
`textbox` role and no `combobox` role; with a `collection` of suggestions it SHALL follow
the `combobox-pattern` "Roles And Relations" requirement. The Label SHALL name the Input
through `<label for>`. The Input SHALL carry `autocomplete="off"`, `autocorrect="off"`,
`autocapitalize="none"` and `spellcheck="false"` unless overridden, and its
`aria-describedby` SHALL reference the `input-chips` summary node, whose text is the
`tagsSummary(tags)` message ("3 tags: Rome, Paris, Oslo"; "No tags"). The Chips, Chip and
ChipRemove roles and names SHALL be those of `input-chips` (toolbar, roving chips named by
their text, `tabindex=-1` remove buttons named `removeLabel(tag)`).

#### Scenario: No combobox without a popup

- **WHEN** a Tags Input without a `collection` is rendered
- **THEN** its input has no `role`, `aria-expanded`, `aria-controls` or
  `aria-activedescendant` attribute

#### Scenario: Existing tags are described

- **WHEN** a screen reader user tabs into a Tags Input holding "Rome" and "Paris"
- **THEN** the input's accessible description is "2 tags: Rome, Paris"

### Requirement: Creating A Tag With Enter

Enter in the Input SHALL, in this order: do nothing while composing (see IME); choose the
highlighted suggestion when suggestions are exposed and one is highlighted (see
Suggestions); create a tag from the draft when the normalised draft is not empty, and in
that case cancel the form's implicit submission synchronously in the same keydown; and when
the draft is empty, leave the key to the browser so the form submits. A created tag SHALL
clear the draft; a refused one SHALL keep it (see Validation And Refusal).

#### Scenario: Draft does not submit the form (unovue/reka-ui#2963)

- **WHEN** the input inside a form holds "rome" and the user presses Enter
- **THEN** a "rome" tag is created, the draft is empty, and the form's `submit` event
  does not fire

#### Scenario: Empty Enter submits

- **WHEN** the draft is empty and the user presses Enter
- **THEN** the form is submitted once and no tag is created

### Requirement: Delimiters

The `delimiter` prop SHALL accept a string, a RegExp or a list of them (default `","`). A
string SHALL be matched literally, a RegExp as a regular expression. Delimiters SHALL be
detected from the text change of the Input (an `input` event that is not part of a
composition), never from key codes: when the text after the change contains a delimiter
and the caret is at the end, every complete segment before the last delimiter SHALL be
created as tags in order and the remainder SHALL stay as the draft. A delimiter typed with
the caret elsewhere SHALL be ordinary text. Segments that are empty after normalising SHALL
be dropped.

#### Scenario: Mobile keyboard comma (chakra-ui/zag#293)

- **WHEN** an Android soft keyboard sends a keydown with `keyCode 229` and then an `input`
  event that turns "rome" into "rome,"
- **THEN** a "rome" tag is created and the draft is empty

#### Scenario: Literal string delimiters (ariakit/ariakit#6333)

- **WHEN** the delimiter is `"|"` and the user types "a|b|"
- **THEN** tags "a" and "b" are created, the page stays responsive, and `"."` as a
  delimiter splits on dots only

#### Scenario: Delimiter alone creates nothing (unovue/reka-ui#2137)

- **WHEN** the draft is "   " and the user types ","
- **THEN** no tag is created and the draft is empty

#### Scenario: Delimiter typed mid-text

- **WHEN** the draft is "romeparis", the caret is after "rome" and the user types ","
- **THEN** no tag is created and the draft is "rome,paris"

### Requirement: IME Composition

While a composition is in progress the Tags Input SHALL NOT create, split, arm, remove or
navigate tags, SHALL NOT validate or announce, and SHALL apply the `keyboard-interactions`
IME guard to every key it handles, including the commit Enter Safari delivers after
`compositionend`. Delimiter detection SHALL run once on the committed text after
`compositionend`. The same rules SHALL hold for the ChipInput.

#### Scenario: Japanese conversion Enter (unovue/reka-ui#1441, chakra-ui/zag#804)

- **WHEN** the user types "amerika" with a Japanese IME, selects "アメリカ" and presses Enter
  to commit it
- **THEN** no tag is created and the draft is "アメリカ"; a second Enter creates the tag

#### Scenario: Spaces inside a Pinyin preedit (ariakit/ariakit#6294)

- **WHEN** the delimiter list includes `/\s/` and a Pinyin IME shows the preedit "ni hao"
- **THEN** no tag is created during the composition and committing "你好" leaves the draft
  "你好"

#### Scenario: Korean syllables (unovue/reka-ui#2024)

- **WHEN** the user composes "한글" and presses Enter
- **THEN** exactly one tag "한글" is created

### Requirement: Normalising And Empty Tags

Every candidate tag text SHALL be passed through `normalize` (default: trim surrounding
whitespace) before validation, duplicate checking and creation; a candidate that is empty
after normalising SHALL never become a tag. `normalize` SHALL be replaceable, including by
the identity function.

#### Scenario: Keep surrounding spaces (chakra-ui/zag#3051)

- **WHEN** `normalize` is the identity and the user enters ", " through a paste with the
  newline delimiter
- **THEN** a tag ", " is created

### Requirement: Duplicates

With `allowDuplicates` false (default) a candidate equal to an existing tag under `compare`
(default: exact string equality) SHALL be refused with reason `duplicate`. With
`allowDuplicates` true, equal tags SHALL coexist, each with its own key, and removal,
editing and focus SHALL act on the chip the user targeted.

#### Scenario: Duplicates allowed (chakra-ui/zag#2927)

- **WHEN** `allowDuplicates` is true, the tags are ["a", "b", "a"] and the user removes
  the first chip
- **THEN** the value is ["b", "a"] and focus is on the chip "b"

### Requirement: Maximum

With `max`, a candidate that would exceed it SHALL be refused with reason `max`, and the
Root and Control SHALL carry `data-at-max` while the count equals `max`. The Input SHALL stay
enabled at the maximum, so tags can still be edited and removed. A controlled value longer
than `max` SHALL be shown as given, with `data-at-max`, and SHALL report reason `max` to
`onRefuse` once.

#### Scenario: Fourth tag at max 3

- **WHEN** `max` is 3, three tags exist and the user enters "oslo"
- **THEN** no tag is created, "oslo" stays in the input, and the `refusedAnnouncement`
  for `max` is announced

### Requirement: Validation And Refusal

`validate(text, value)` SHALL be called for each normalised candidate (typed, pasted,
chosen from suggestions or edited) after the duplicate and `max` checks; it returns `true`
to accept or a string reason to refuse. A refused candidate SHALL stay in the Input (or in
the ChipInput while editing), the Input SHALL carry `data-refused` with the reason until
the draft next changes, `onRefuse({ reason, text })` SHALL be called, and the
`refusedAnnouncement(reason, text)` message SHALL be announced politely. Refusing a draft
SHALL NOT make the component invalid for form validation.

#### Scenario: Invalid email

- **WHEN** `validate` refuses texts without "@" and the user enters "bob"
- **THEN** no tag is created, the input shows "bob" with `data-refused`, and one polite
  announcement is made

#### Scenario: Refusal is not a form error

- **WHEN** a required Tags Input with one tag refuses a draft and the form is submitted
- **THEN** the form's validity is not affected by the refusal

### Requirement: Paste

With `addOnPaste` (default true), a paste whose text contains a paste delimiter
(`pasteDelimiter`, default the `delimiter` list plus newline, tab and `;`) SHALL be taken
over: the text is split, each segment is normalised, checked and validated on its own and
accepted segments become tags in order in one change; refused segments SHALL be put back
into the draft joined by the first string delimiter; one `addedManyAnnouncement(count)`
SHALL be announced. A paste without a paste delimiter, or with `addOnPaste` false, SHALL be
ordinary text insertion handled by the browser, so repeated pastes and native undo keep
working.

#### Scenario: Paste a list of emails (unovue/reka-ui#1400)

- **WHEN** the user pastes "jane@x.io, john@x.io\nalex@x.io"
- **THEN** three tags are created in that order with one change and one announcement

#### Scenario: Plain paste stays text (chakra-ui/zag#1665)

- **WHEN** the user pastes "foo" twice and then undoes
- **THEN** the draft is "foofoo" after the pastes and "foo" after the undo

#### Scenario: Paste works from every state (chakra-ui/zag#1662, chakra-ui/zag#1342)

- **WHEN** the user pastes, presses Enter, removes the created tag and pastes again, with
  `addOnPaste` true and with it false
- **THEN** the second paste is handled exactly like the first

#### Scenario: Partly refused paste

- **WHEN** `validate` refuses "bob" and the user pastes "jane@x.io, bob"
- **THEN** "jane@x.io" becomes a tag and the draft is "bob" with `data-refused`

### Requirement: Blur Behaviour

When focus leaves the component (not when it moves between the Input, chips, ChipInput,
ChipRemove, ClearTrigger or the suggestion popup), `blurBehavior` SHALL decide what happens
to a non-empty draft: `keep` (default) leaves it, `add` creates a tag from it (subject to
all checks; a refused draft stays), `clear` empties it. Leaving the component SHALL also
clear any chip highlight or armed Backspace.

#### Scenario: Choosing a suggestion is not a blur (unovue/reka-ui#2259)

- **WHEN** `blurBehavior` is `add`, the draft is "a" and the user clicks the suggestion
  "Apple"
- **THEN** exactly one tag "Apple" is created and no tag "a"

#### Scenario: Tab out clears the highlight (chakra-ui/ark#3602, unovue/reka-ui#1914)

- **WHEN** the last chip is armed by Backspace and the user presses Tab, or clicks outside
- **THEN** no chip carries `data-highlighted` and the next Backspace in the input arms
  again instead of removing

### Requirement: Chips

The Tags Input SHALL render its tags with `input-chips` and SHALL add: a Chip with
`disabled` (or every chip when the component is read-only) is skipped by navigation and by
Backspace arming and cannot be removed by the user; removal SHALL target the chip by key;
any press in the Input or caret move SHALL disarm an armed chip; a press on the Control
outside a chip or button SHALL focus the Input; typing a printable character or pasting
while a chip is focused SHALL move focus to the Input and insert the text there.

#### Scenario: Disabled tag is not removed (unovue/reka-ui#2785)

- **WHEN** the tags are "admin@acme.com" (disabled) and "user@x.io", and the user presses
  Backspace twice in the empty input
- **THEN** "user@x.io" is removed and "admin@acme.com" remains

#### Scenario: Click in the input disarms (chakra-ui/zag#2328)

- **WHEN** the last chip is armed, the user clicks at the end of the draft "ab" and presses
  Backspace
- **THEN** the draft is "a" and no tag is removed

#### Scenario: Control padding focuses the input (mui/base-ui#4289, ariakit/ariakit#7155)

- **WHEN** the user clicks the empty area of the Control
- **THEN** focus is in the Input

#### Scenario: Delete repairs focus (chakra-ui/zag#1911)

- **WHEN** the middle of three chips is focused and the user presses Delete, then
  ArrowLeft
- **THEN** focus moved to the following chip and then to the first chip

### Requirement: Editing A Tag

With `editable` (default true) and the component interactive, Enter on a focused Chip or
a double press on it SHALL replace the chip's text with the ChipInput holding the tag's
text, all selected, focused within the same user event (so mobile keyboards open). In the
ChipInput, Enter and blur SHALL commit and Escape SHALL cancel; a commit SHALL normalise and
check the text like a new tag (a duplicate of the edited tag itself is allowed); an empty
commit SHALL remove the tag; a refused commit SHALL keep the ChipInput open with
`data-refused`. After commit or cancel by key, focus SHALL return to the chip (or, when
removed, follow the chips' removal rule). The `editLabel(tag)` message SHALL name the
ChipInput and `updatedAnnouncement(tag)` SHALL be announced after a changed commit.

#### Scenario: Edit and commit (chakra-ui/ark#2003)

- **WHEN** the user focuses the chip "rom", presses Enter, types "rome" and presses Enter,
  then types "x" in the main input and presses Enter
- **THEN** the tags are ["rome", "x"] and focus is in the main input

#### Scenario: Keyboard opens on iOS (chakra-ui/ark#1396)

- **WHEN** a touch user double-taps a chip
- **THEN** the ChipInput receives focus synchronously in the tap's event handler

#### Scenario: Escape cancels

- **WHEN** the user edits "rome" to "paris" and presses Escape
- **THEN** the tag is "rome" and focus is on its chip

### Requirement: Suggestions

When a `collection` is given, the Tags Input SHALL behave as the `combobox-pattern` input
over it, in one machine: choosing an option (Enter on the highlight, or a press) SHALL
create a tag whose value is the option's key, subject to all checks, clear the draft and
keep the popup open (`closeOnChoose`, default false). A tag whose value is a key in the
collection SHALL show the option's text in its chip and in announcements. Options whose key
is already a tag SHALL be hidden from the results unless `allowDuplicates`. Enter with no
highlight SHALL create a tag from the draft (free text), unless `allowCustom` is false, in
which case it SHALL be refused with reason `invalid`. Chip navigation, removal and editing
SHALL count as inside for the popup's dismissal.

#### Scenario: One commit per action (chakra-ui/zag#1661, chakra-ui/ark#2742)

- **WHEN** the user pastes "part", presses Enter, removes the tag and then chooses
  "Partner" from the suggestions
- **THEN** each action changed the value exactly once and the value is ["partner"]

#### Scenario: Remove buttons work with suggestions open (unovue/reka-ui#1579)

- **WHEN** the popup is open and the user presses a ChipRemove
- **THEN** the tag is removed, the popup stays open and the draft is kept

### Requirement: Clear Trigger

ClearTrigger SHALL remove every user-removable tag and empty the draft in one change with
reason `clear`, move focus to the Input, announce `clearedAnnouncement`, be named by the
`clearLabel` message, be `tabindex=-1` (keyboard users clear by chips or select-all + Delete)
and carry `data-visible` only when there is something to clear.

#### Scenario: Clear

- **WHEN** two tags and the draft "x" exist and the user presses ClearTrigger
- **THEN** the value is empty, the draft is empty, focus is in the Input and one
  announcement is made

### Requirement: Announcements

The Tags Input SHALL announce through the injected Announcer, politely, with the component's
locale: `addedAnnouncement(tag)` after a tag is created by Enter, delimiter, blur or
suggestion; `addedManyAnnouncement(count)` after a paste; `input-chips`'
`removedAnnouncement(tag)` after a removal; `updatedAnnouncement(tag)` after an edit;
`refusedAnnouncement(reason, text)` after a refusal; `clearedAnnouncement` after Clear. It
SHALL render no `aria-live` region of its own, and SHALL make one announcement per user
action.

#### Scenario: Removal is spoken (ariakit/ariakit#7164)

- **WHEN** a screen reader user removes the chip "Rome"
- **THEN** the announcer records exactly one polite message for "Rome", and no element of
  the component has `aria-live`

### Requirement: Form Participation

The Tags Input SHALL take part in forms through `hidden-form-input` as a list-valued
component: with `name`, one value carrier per tag is submitted in order under that name;
`required` makes the constraint input invalid exactly while there are no tags, and an
`invalid` event or a focus on it SHALL move focus to the Input. The visible Input SHALL
have no `name` (the draft is not submitted) unless `inputName` is given. A form reset SHALL
restore `defaultValue`, empty the draft and close the popup. The carriers SHALL reflect
every change before the change callback returns.

#### Scenario: Current tags are submitted (chakra-ui/zag#3193)

- **WHEN** a Tags Input named `to` created with `defaultValue=["a"]` gets "b" and loses
  "a", and its form is submitted
- **THEN** the form data has exactly one `to` entry, "b"

#### Scenario: Required

- **WHEN** a required Tags Input with no tags and the draft "x" is submitted
- **THEN** submission is blocked, focus is in the Input, and the draft is not submitted

#### Scenario: Reset

- **WHEN** the form is reset after the user added two tags and typed a draft
- **THEN** the tags equal `defaultValue` and the draft is empty

### Requirement: Disabled, Read-Only And Field Integration

The Tags Input SHALL register with a Field through `field-control` (validity element: the
constraint input), and its `disabled`, `readOnly`, `required` and `invalid` SHALL merge with
the Field's and Fieldset's. Disabled: the Input is natively disabled, chips are not
focusable and nothing can be created, edited or removed. Read-only: the Input is
`readonly`, chips stay focusable and navigable (so their text can be read) but cannot be
removed or edited, ChipRemove and ClearTrigger are not rendered as actionable
(`aria-disabled="true"`). `invalid` sets `aria-invalid` on the Input.

#### Scenario: Read-only browse

- **WHEN** a read-only Tags Input holding "Rome" is focused and the user presses ArrowLeft
  then Backspace
- **THEN** focus is on "Rome" and the tag remains

### Requirement: Tags Input Data Attributes

Root and Control SHALL carry `data-focus` (focus anywhere in the component),
`data-focus-visible`, `data-disabled`, `data-readonly`, `data-invalid`, `data-empty-value`
(no tags) and `data-at-max`; Input SHALL carry `data-refused` (with the reason as value)
and `data-empty` when the draft is empty; Chip SHALL carry the `input-chips` attributes
plus `data-editing` while its ChipInput is open and `data-disabled` for a disabled tag;
ChipInput SHALL carry `data-refused`; ClearTrigger `data-visible`; suggestion parts the
`combobox-pattern` attributes. Every part SHALL pass `data-variant` and `data-size` through
unchanged.

#### Scenario: Editing chip

- **WHEN** the chip "rome" is being edited
- **THEN** it carries `data-editing` and the ChipInput is its descendant

### Requirement: Tags Input Messages

Every string that reaches assistive technology SHALL come from the typed `messages` object
with English defaults: `chipsLabel`, `removeLabel(tag)`, `tagsSummary(tags)`,
`editLabel(tag)`, `clearLabel`, `addedAnnouncement(tag)`, `addedManyAnnouncement(count)`,
`removedAnnouncement(tag)`, `updatedAnnouncement(tag)`, `refusedAnnouncement(reason, text)`
and `clearedAnnouncement`, plus the pattern messages when suggestions are used. Counts SHALL
use `Intl.PluralRules` of the component's locale.

#### Scenario: Localised summary

- **WHEN** the locale is `it` and messages are overridden with Italian texts
- **THEN** the summary reads the Italian plural for one and for three tags

### Requirement: Tags Input Contract

`tagsInputContract` SHALL locate an instance by role (`textbox`, or `combobox` with
suggestions) and exact accessible name, SHALL include the `input-chips` contract fragment
and, with suggestions, the `combobox-pattern` contract, and SHALL add actions `type(text)`,
`addTag(text)` (keyboard: type then Enter; declared without a pointer implementation, with
the reason that creation has no pointer gesture), `paste(text)`, `editTag(name, text)`
(keyboard: focus the chip, Enter, replace, Enter; pointer: double press), `removeTag(name)`,
`clear()`, `compose(text, commit)`; queries `tags()`, `inputValue()`, `isAtMax()`,
`refusal()` and `announcements()`; the traits `form-associated`, `field-associated` and
`composite-roving` (chips), plus the pattern traits with suggestions; declared `data-state`
per state for Root; and an event map in which every machine event maps to an action,
`{ skip: "reason" }` or a `$sync:value` / `$sync:inputValue` prop step.

#### Scenario: Paste through the driver

- **WHEN** a test runs `paste("a, b")` then `tags()`
- **THEN** the driver dispatches a paste with that clipboard text and resolves with
  `["a", "b"]`

#### Scenario: Composition through the driver

- **WHEN** a test runs `compose("東京", true)` then `pressEnter()`
- **THEN** the first Enter creates nothing and the second creates "東京"

### Requirement: Theme

`@rind-ui/theme` SHALL ship `tags-input.css` in `@layer rind.components` with `:where()`
selectors on the styling contract, reading only tier-3 `--rind-tags-input-*` tokens (with
fallbacks to the matching `--rind-combobox-*` chip and control tokens, never declared by the
stylesheet), the `data-variant` (solid, soft, outline, ghost) and `data-size` (sm, md, lg)
matrix on Control and Chip, a `data-tone="danger"` state for `data-invalid` and
`data-refused`, an Input sized with `field-sizing: content` and a minimum inline size,
chips with a visible border, an outline for the highlighted chip, and ≥ 24×24 CSS px
targets for ChipRemove and ClearTrigger.

#### Scenario: Forced colors

- **WHEN** the themed component is rendered with `forced-colors: active` and a chip is
  highlighted
- **THEN** every chip has a visible border and the highlighted chip a visible outline
