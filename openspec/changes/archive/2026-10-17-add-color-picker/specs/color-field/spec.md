## Purpose

Defines rind-ui's two colour text inputs: the **Color Field**, a text input for a whole colour (hex by default, any CSS colour
with `format="css"`), and the **Color Channel Field**, a numeric input for one channel of a colour built on Number Input. Both
commit on explicit points and never while typing. Research: `docs/research/color-picker.md`.

## ADDED Requirements

### Requirement: Color Field Anatomy

A Color Field SHALL consist of `Root` (a Field host: when not inside a Field it acts as one, as Text Field's Root does; inside
a Field it registers as that Field's control and its own Label, Description and ErrorMessage are not rendered, with a
development warning), `Label`, `Description`, `ErrorMessage`, `Input` (`<input type="text">`) and an automatic hidden input for
form participation (`hidden-form-input`). Every part SHALL accept the `render` prop and forward its element's attributes
(reka-ui#2545). Inside a Color Picker the Field is **embedded**: it registers with no Field and renders no Label of its own
(the picker's `ChannelInput` renders it).

#### Scenario: Standalone

- **WHEN** a Color Field with Label "Brand colour" and an Input is rendered
- **THEN** exactly one `textbox` exists, named "Brand colour", and one hidden input is in the form

#### Scenario: Attributes forwarded (reka-ui#2545)

- **WHEN** `data-testid` and `class` are passed to `Root`
- **THEN** they appear on the root element

### Requirement: Color Field Value And Commit

The Color Field SHALL expose `value` (`string | Color | null`), `defaultValue` (default `null`), `onValueChange(color | null,
details)` with `details.reason` (`INPUT.COMMIT`, `RESET`, `ADOPT`), `modality` and `cancel()`, `onInputValueChange(text)`, `format`
(`hex`, the default, or `css`), `alpha` (default false) and `colorSpace` as `color-model` defines. While the input is focused the text SHALL
be free: it SHALL NOT be reformatted, the caret SHALL NOT move and the value SHALL NOT change on an edit. The text SHALL be committed on
Enter, on blur, and when the owning component asks for it (`flush`, below). A commit SHALL parse the text leniently: `#` optional,
any letter case, hex of 3 or 6 digits (4 or 8 when `alpha`) for `format="hex"`, any string `parseColor` accepts for
`format="css"`. A valid draft SHALL call `onValueChange` once and the input SHALL then show the formatted colour (`#RRGGBB`,
`#RRGGBBAA` when alpha is below 1 and `alpha` is true; `css`: `formatColor(color, "css")`); an unchanged colour calls nothing. An empty draft
SHALL commit `null`. A non-empty draft that does not parse SHALL be kept as typed, the value unchanged and the field invalid
(`aria-invalid="true"`, `data-invalid`, the Field's `badInput` message `messages.invalid`) until the next edit or a valid commit; Escape on a dirty
draft SHALL restore the text of the current value and call `preventDefault` (a clean field leaves Escape unhandled). A committed 6-digit hex SHALL keep
the current alpha; an 8-digit hex SHALL set it (zag#884). With `alpha` false the Field SHALL never change alpha.

#### Scenario: Typing does not change the value (react-spectrum#5484)

- **WHEN** the user types `#334` into a controlled Field showing `#112233`
- **THEN** the input shows `#334` as typed, `onInputValueChange` ran for each edit, and `onValueChange` was not called

#### Scenario: Enter commits (react-spectrum#10445)

- **WHEN** the user types `3366ff` (no `#`) and presses Enter
- **THEN** `onValueChange` is called once with `#3366FF` and the input shows `#3366FF`

#### Scenario: Lower case and paste (react-spectrum#7547)

- **WHEN** `#e84e0f` and `e84e0f` are pasted in turn and committed
- **THEN** both commit `#E84E0F`

#### Scenario: Alpha kept (zag#884)

- **WHEN** a Field with `alpha` on `#FF000080` commits `00FF00`
- **THEN** the emitted colour is green with alpha 0.5; committing `00FF00FF` sets alpha 1

#### Scenario: Empty and invalid

- **WHEN** the text is cleared and committed, and separately `#12345` is committed
- **THEN** the first emits `null`; the second keeps the text, leaves the value, and sets `aria-invalid="true"`

#### Scenario: Escape reverts a dirty draft

- **WHEN** the user edits the text and presses Escape inside a Popover, then Escape again
- **THEN** the first Escape restores the text and the Popover stays open; the second closes it

### Requirement: Text Filtering

An edit (typing, paste, drop, IME composition end) whose resulting text is not acceptable partial input SHALL be rejected
and the previous text and caret restored: for `format="hex"` the text must match an optional `#` followed by at most 6 (8 with
`alpha`) hexadecimal digits; for `format="css"` any text is acceptable. The check SHALL be made on the resulting text in
`beforeinput` and again in `input` (devices that do not cancel `beforeinput`), never on key codes. Pasted text SHALL be trimmed.

#### Scenario: Android keeps six digits (react-spectrum#3985)

- **WHEN** the text is `#FFFFFF` and a soft keyboard inserts `A` through composition
- **THEN** the text is still `#FFFFFF`

#### Scenario: Bad paste

- **WHEN** `hello` is pasted into a hex Field
- **THEN** the text is unchanged

### Requirement: Controlled Text

While the input has an uncommitted edit, a controlled `value` change SHALL NOT overwrite the text; when there is no uncommitted
edit, the text SHALL follow `value` at once. After a commit the text SHALL show the controlled value even when the parent refused
the change (the field never keeps a text that differs from the controlled value after a commit point).

#### Scenario: Refused commit

- **WHEN** a controlled Field commits `#ABCDEF` and the parent keeps `#112233`
- **THEN** after the commit the input shows `#112233`

### Requirement: Flush Before Close

A Color Field SHALL expose `flush()` (and a `FlushRegistry` the Color Picker provides to its descendants): a valid pending draft SHALL
be committed, an invalid or empty one discarded, in the same task. The Color Picker SHALL call it before closing for an outside press or outside focus, because React does not blur an unmounting input (react-spectrum#9748).

#### Scenario: Outside press commits the typed hex (react-spectrum#9748)

- **WHEN** the user types `111111` in the picker's hex input and presses outside the popover
- **THEN** the picker's colour is `#111111` and `onValueChange` ran once before `onOpenChange(false)`

### Requirement: Field Semantics

The Input SHALL be `<input type="text">` with `autocomplete="off"`, `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"` and no
`maxlength`, named by the Label (or consumer `aria-label`), described by the Field's description and error. `aria-invalid`
and `data-invalid` SHALL follow the Field's validity and the invalid-draft state above. The role SHALL stay `textbox` (no spinbutton).
`required`, `disabled`, `readOnly` SHALL apply to the Input and the hidden input; a read-only Field SHALL stay focusable and ignore edits.

#### Scenario: No spellcheck (react-spectrum#2598)

- **WHEN** the Input is rendered
- **THEN** it has `spellcheck="false"` and `autocomplete="off"`

### Requirement: Form Participation

The hidden input SHALL carry `name`, `form`, `required`, `disabled`, mirror the colour as its `value` property in the canonical form
`#RRGGBB` (`#RRGGBBAA` when alpha is below 1; the empty string for `null`) following `hidden-form-input`, and be the Field's validity element. The visible
Input SHALL carry no `name`. A form reset SHALL restore the current `defaultValue` with reason `RESET` and no commit. A native change on the
hidden input that the component did not make (autofill) SHALL be adopted as a commit when it parses.

#### Scenario: Submitted

- **WHEN** a form has a Color Field `name="fill"` showing `#3366ff` typed lower case
- **THEN** the form data contains `fill=#3366FF`

#### Scenario: Required and empty

- **WHEN** a required, empty Color Field is submitted
- **THEN** submission is blocked and the visible Input receives focus

### Requirement: Color Channel Field

The Color Channel Field SHALL render a Number Input (`number-input`, not re-specified: typing and commit, keyboard steps and
large steps, steppers, press and hold, wheel, paste, announcements, Field integration and the hidden input) with the parts of Number Input
and these bindings: `channel` (required), the colour value rules of `color-model`, `min`, `max`, `step` and the large step from the
channel's range, `commitBehavior="snap"`, and `formatOptions`: `hue` degrees (`unit` `degree`), `saturation`, `lightness` and
`brightness` the `unit` `percent` style on their 0–100 range (displaying "50%"), `alpha` the `percent` style on its 0–1 value, and `red`, `green`, `blue` integers.
A commit SHALL turn the number into `withChannel(color, channel, number)` and call `onValueChange(color, details)` once; the other channels and
alpha SHALL be kept. An empty or unparsable commit SHALL restore the field's text (a colour always has every channel). A typed value outside the range
SHALL be clamped on commit in every colour space, for every channel (zag#1567); typing alpha as `50` or `50%` SHALL give 0.5 and typing `33.3` 0.33 (kobalte#589).
The default name, when there is no Label, SHALL be the channel name from `messages`. Inside a Color Picker the field is embedded. It SHALL carry `data-channel`.

#### Scenario: Clamping any channel (zag#1567)

- **WHEN** `999` is typed into hue, saturation and brightness channel fields and each is committed
- **THEN** they show `360°`, `100%` and `100%` and emit those values

#### Scenario: Alpha as percent (kobalte#589)

- **WHEN** `50` is typed into the alpha field and committed
- **THEN** alpha is 0.5 and the field shows `50%`; `33.3` commits 0.33 and shows `33%`

#### Scenario: Channel the value lacks (ark#1649)

- **WHEN** a `hue` Color Channel Field receives `rgb(255, 0, 0)`
- **THEN** it shows `0°`, and committing `120` emits the colour as `rgb` with hue 120

#### Scenario: Empty commit restores

- **WHEN** the red field's text is cleared and blurred
- **THEN** it shows the previous red and no callback ran

#### Scenario: Keyboard step

- **WHEN** ArrowUp is pressed in the focused red field showing 10
- **THEN** red is 11, `onValueChange` and `onValueCommit` ran once each

### Requirement: Contract

`getColorField` SHALL locate by role `textbox` and name, with actions `type(text)` (types without committing), `commit()` (Enter),
`blur()`, `paste(text)`, `escape()`, `fill(text)` (type then commit), `resetForm()`; queries `text()`, `color(format?)`, `isInvalid()`,
`formValue()`; traits `form-associated` and `field-associated`. `getColorChannelField` SHALL be `getNumberInput` with queries `channel()` and
`color(format?)`. Observations: `idle` and `dirty` (an uncommitted edit).

#### Scenario: Same driver in both environments

- **WHEN** `getColorField(screen, { name: "Fill" }).fill("3366ff")` runs in jsdom and with `page` in Playwright
- **THEN** both resolve with `text()` equal to `#3366FF`

### Requirement: Theme

`color-field.css` SHALL follow the theme convention with `--rind-color-field-*` tokens reading Text Field's and Number Input's as
fallbacks (family `field`, variants `outline` and `soft`, sizes), an optional leading swatch slot through `Color Swatch`, monospaced
digits for the hex Input, an invalid state with a non-colour cue, forced-colors rules, `data-tone="danger"`.

#### Scenario: Invalid cue

- **WHEN** the Field is invalid
- **THEN** the border changes in width or style as well as colour
