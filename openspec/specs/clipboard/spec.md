# clipboard Specification

## Purpose
TBD - created by archiving change add-code-block. Update Purpose after archive.
## Requirements
### Requirement: Injected Clipboard Capability

The Environment SHALL expose a `clipboard` capability with
`writeText(text: string, options?: { near?: Element }): Promise<void>`, so machines copy text
through an injected abstraction and tests run without a DOM. The test environment SHALL provide
a fake that records writes and can be told to reject or to be absent.

#### Scenario: Fake in node tests

- **WHEN** a machine copies "abc" in a node test with the fake clipboard
- **THEN** the fake's log holds "abc" and the promise resolves

#### Scenario: Fake set to fail

- **WHEN** the fake is set to reject and a machine copies
- **THEN** the promise rejects with an error the machine can report

### Requirement: DOM Clipboard Implementation

The DOM implementation SHALL use `navigator.clipboard.writeText` when it is a function, checked
at call time; when it is absent, or when it rejects (no permission, an iframe without
`clipboard-write`), it SHALL fall back to a temporary visually hidden element holding the
text, inserted next to `near` (or into `document.body` without `near`) so it is inside the same
layer and not inert, selected and copied with `document.execCommand("copy")`, then removed and
the previous selection and focus restored. It SHALL reject when both paths fail, and SHALL never
throw synchronously.

#### Scenario: Insecure context (regression: docusaurus#11791)

- **WHEN** `navigator.clipboard` is undefined
- **THEN** `writeText` uses the fallback and resolves when `execCommand` reports success

#### Scenario: Inside a modal dialog (regression: docusaurus#11109)

- **WHEN** `writeText` falls back with `near` inside an open modal `<dialog>`
- **THEN** the temporary element is inserted inside the dialog and the copy succeeds

#### Scenario: Focus and selection restored

- **WHEN** the fallback runs while a text selection exists and a button has focus
- **THEN** after the copy the same selection exists and the same button has focus

#### Scenario: Both paths fail

- **WHEN** the Clipboard API rejects and `execCommand` returns false
- **THEN** `writeText` rejects and nothing is thrown synchronously

### Requirement: Clipboard Anatomy

A Clipboard component SHALL consist of `Root` and `Trigger`, with optional `Label`, `Control`,
`Input`, `Indicator` and `ValueText`. The `Trigger` SHALL be a native
`<button type="button">`. The `Input` SHALL be a read-only `<input>` whose value is the
component's `value`. The `Indicator` SHALL be `aria-hidden="true"`. `ValueText` SHALL render
the value unless it has children. No part SHALL reference the id of a part that is not
rendered. Every part SHALL accept the `render` prop.

#### Scenario: Bare copy button

- **WHEN** a Clipboard with only `Root` and `Trigger` and `value="abc"` is rendered
- **THEN** exactly one button named "Copy" exists, it has `type="button"`, and no element
  carries an IDREF to a missing id

#### Scenario: Field and button

- **WHEN** a Clipboard with a Label "API key", an Input and a Trigger is rendered with
  `value="sk-123"`
- **THEN** a read-only textbox named "API key" has the value "sk-123" and the button is named
  "Copy API key"

#### Scenario: Inside a form (regression: Zag 0.77.1)

- **WHEN** the Trigger of a Clipboard inside a `<form>` is pressed
- **THEN** the form is not submitted

### Requirement: Copy States

The component SHALL be in one of the states `idle`, `copying`, `copied` and `error`. Pressing
the Trigger in `idle`, `copied` or `error` SHALL enter `copying` and write the current `value`
prop, read when the write starts, through the Environment's `clipboard` with the Trigger as
`near`. The state SHALL stay `copying` until the write settles, then become `copied` on
success or `error` on rejection, including the absence of every clipboard path. `copied` and
`error` SHALL return to `idle` after `copyFeedbackDuration` (default 2000 ms) of the injected
Scheduler; a new result SHALL restart that delay. A press while `copying` SHALL be ignored. A
result that arrives after the component left `copying` (unmounted) SHALL be dropped.
`onCopy(details)` SHALL be called once per result with `{ ok: true, source }` or
`{ ok: false, error, source }`, `source` being `"trigger"` or `"input"`.

#### Scenario: Failure is not reported as success (regression: Zag clipboard machine)

- **WHEN** the Trigger is pressed and the clipboard rejects
- **THEN** the state goes `copying` then `error`, never `copied`, and `onCopy` receives
  `ok: false` with the rejection's error

#### Scenario: No clipboard at all (regression: Mantine#3271, VueUse#1639)

- **WHEN** the Trigger is pressed with the fake clipboard set to `absent`
- **THEN** the state becomes `error` and "Copy failed" is announced

#### Scenario: Feedback ends

- **WHEN** a copy succeeds and 2000 ms of the scheduler pass
- **THEN** the state is `idle`; after 1999 ms it is still `copied`

#### Scenario: Copy again restarts the timer

- **WHEN** the Trigger is pressed again 1500 ms after a successful copy and the second write
  succeeds
- **THEN** the state is still `copied` 1000 ms later and `idle` 2000 ms after the second result

#### Scenario: One write at a time (regression: VueUse#5539)

- **WHEN** the Trigger is pressed twice while the first write is pending
- **THEN** the clipboard receives one write and `onCopy` is called once

#### Scenario: Value read at press time (regression: Chakra#6923)

- **WHEN** `value` changes from "a" to "b" and the Trigger is then pressed
- **THEN** the clipboard receives "b"

### Requirement: Write In The User Gesture

The write SHALL start synchronously in the task of the Trigger's `click` event: no `await`,
timer, animation frame or deferred effect SHALL run between the click and the call to the
clipboard's `writeText`. The Trigger SHALL copy on `click` (which an assistive-technology press
also produces) and not on `pointerdown` or `pointerup` alone.

#### Scenario: Synchronous write (regression: VueUse#5368, copy-to-clipboard#109)

- **WHEN** the Trigger is clicked with a fake clipboard that records the call stack's task
- **THEN** `writeText` was called before the click handler returned

#### Scenario: Assistive technology press

- **WHEN** the Trigger receives a bare `click` (`detail` 0, no pointer events)
- **THEN** the value is written

### Requirement: Trigger Name

The Trigger's accessible name SHALL NOT depend on the copy state. It SHALL be `messages.copy`
("Copy") and, when a `Label` is rendered, the Trigger SHALL be labelled by itself and the
Label, in that order. A consumer `aria-label` or `aria-labelledby` on the Trigger SHALL
replace the default.

#### Scenario: Stable name (regression: Zag trigger label swap)

- **WHEN** a Clipboard labelled "Invite link" copies successfully
- **THEN** the Trigger's name is "Copy Invite link" before, during and after `copied`

#### Scenario: Consumer name wins

- **WHEN** the Trigger is given `aria-label="Copy token"`
- **THEN** its name is "Copy token"

### Requirement: Copy Announcements

A success SHALL be announced politely through the injected Announcer with `messages.copied`
("Copied") and a failure with `messages.copyFailed` ("Copy failed"), once per result, keyed per
instance and carrying the component's locale. The component SHALL render no live region of its
own and SHALL NOT move focus.

#### Scenario: Each press is heard

- **WHEN** the Trigger is pressed twice, each write succeeding
- **THEN** the recording Announcer holds two "Copied" messages and focus stayed on the Trigger

#### Scenario: Two instances

- **WHEN** two Clipboards copy within the same tick
- **THEN** both announcements are kept (different keys)

### Requirement: Clipboard Input

The `Input` SHALL be read-only, focusable and named by the Label. A focus by keyboard, and the
pointer press that focuses it, SHALL select the whole value; later pointer presses SHALL keep
the native selection behaviour. A native `copy` event in the Input SHALL enter `copied`
(source `"input"`, without a write) only when the selection covers the whole, non-empty value;
any other copy SHALL change nothing.

#### Scenario: Tab selects the value

- **WHEN** the Input with value "sk-123" receives focus by Tab
- **THEN** the selected text is "sk-123"

#### Scenario: Partial copy is not "copied" (regression: Zag INPUT.COPY)

- **WHEN** the user selects "sk-" in the Input and copies
- **THEN** the state stays `idle` and nothing is announced

#### Scenario: Whole-value copy

- **WHEN** the user selects the whole value in the Input and copies
- **THEN** the state is `copied`, "Copied" is announced and `onCopy` receives
  `{ ok: true, source: "input" }`

### Requirement: Clipboard Disabled

With `disabled`, the Trigger SHALL be natively disabled, presses SHALL not copy, the Input
SHALL be disabled, and every part SHALL carry `data-disabled`. A write already pending when
`disabled` becomes true SHALL still report its result.

#### Scenario: Disabled press

- **WHEN** a disabled Clipboard's Trigger is clicked
- **THEN** the clipboard receives no write and the state stays `idle`

### Requirement: Clipboard Data Attributes

Every part SHALL carry `data-scope="clipboard"`, `data-part`, `data-instance`, `data-state`
(`idle`, `copying`, `copied` or `error`) and `data-disabled` while disabled. The Trigger and
the Input SHALL carry `data-focus` and `data-focus-visible`.

#### Scenario: State on every part

- **WHEN** a copy fails
- **THEN** Root, Control, Input, Trigger, Indicator and ValueText all carry
  `data-state="error"`

### Requirement: Clipboard Messages

Every string that reaches assistive technology SHALL come from `messages` (`copy`, `copied`,
`copyFailed`), overridable per instance and through the provider.

#### Scenario: Localised

- **WHEN** a Clipboard with `messages={{ copy: "Copia", copied: "Copiato", copyFailed: "Copia
  non riuscita" }}` and `locale="it"` copies
- **THEN** the Trigger is named "Copia" and "Copiato" is announced with `lang` "it"

### Requirement: Clipboard Contract

The component SHALL ship `clipboardContract`, located by the Label's text or as the only
Clipboard in the target, with actions `copy` (pointer, touch, keyboard), `settleCopy`,
`copyFromInput` and `copyPartOfInput`, queries `copyState`, `value`, `inputValue`,
`triggerName` and `isDisabled`, and a `getClipboard` driver. The contract Env's `Part` SHALL
gain `copySelection()`, which dispatches a cancelable, bubbling `copy` event at the selection
(DOM adapter) or presses the platform copy chord (Playwright adapter).

#### Scenario: Same driver test in jsdom and a browser

- **WHEN** `getClipboard(screen, { label: "API key" })` copies with the fake clipboard set to
  `succeed`, in jsdom and in Chromium
- **THEN** both report `copyState` "copied" after `settleCopy` and the fake's log holds the
  value

### Requirement: Clipboard Invariants

After every model step the Trigger's name SHALL be the same as before the step; every part's
`data-state` SHALL equal the machine state; the Indicator SHALL be `aria-hidden`; and the
number of announcements SHALL equal the number of results.

#### Scenario: Model walk

- **WHEN** `testMachine(clipboardContract, …)` walks every transition with the fake set to
  succeed, reject and absent
- **THEN** every invariant holds after every step

### Requirement: Shared Copy Logic

Clipboard and Code Block SHALL use one implementation of the clipboard write effect and of the
copy announcement. Code Block's behaviour SHALL not change.

#### Scenario: Code Block unchanged

- **WHEN** Code Block's existing copy tests run after the extraction
- **THEN** they pass without modification

### Requirement: Clipboard Theme

`@rind-ui/theme` SHALL ship `clipboard.css` in `@layer rind.components` with `:where()`
selectors and logical properties, in the `field` family. The Control SHALL be the field
surface holding the Input and the Trigger; a Trigger without a Control SHALL be a ghost icon
button at least 24 × 24 CSS px. The Indicator SHALL draw a different icon shape per state
(copy, check, x), with the success tone for `copied` and the danger tone for `error`. Under
forced colors the icon SHALL use system colours; transitions SHALL be off under reduced
motion.

#### Scenario: Result by shape

- **WHEN** a themed Clipboard goes from `idle` to `copied` to `idle` to `error`
- **THEN** the Indicator shows the copy, check, copy and x icons, each distinct without colour

