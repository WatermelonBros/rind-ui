# press-interactions Specification

## Purpose
Defines one activation model for every pressable part across mouse, pen, touch,
keyboard and assistive technology, plus long press and hover, so machines receive
normalised press events and never handle raw `click`, `pointerdown` or `keydown` for
activation.
## Requirements
### Requirement: Press Events

A pressable part SHALL send its machine the events `PRESS.START`, `PRESS.END`,
`PRESS.UP`, `PRESS` (activation) and `PRESS.CANCEL`, each carrying `modality`, the
originating `pointerType` (`mouse`, `pen`, `touch`, `keyboard` or `virtual`) and the
`shiftKey`, `ctrlKey`, `metaKey` and `altKey` state. A pressable part SHALL carry
`data-pressed` while a press is in progress and the pointer is over it. A disabled
pressable part SHALL send no press events.

#### Scenario: Mouse click

- **WHEN** the user presses and releases the mouse on a button
- **THEN** the machine receives `PRESS.START`, `PRESS.UP`, `PRESS.END` and one `PRESS`,
  all with `pointerType: "mouse"`, and `data-pressed` is present only between press and
  release

#### Scenario: Disabled part

- **WHEN** a disabled pressable part is clicked, tapped or activated with Enter
- **THEN** the machine receives no press event

### Requirement: Activation On Release

Activation SHALL happen on release, never on press-down. A press whose pointer leaves
the part SHALL remove `data-pressed`; releasing outside the part SHALL NOT activate;
returning over the part before release SHALL restore `data-pressed` and allow
activation. A `pointercancel` (for example a scroll that starts during a touch) SHALL
send `PRESS.CANCEL` and no activation.

#### Scenario: Press moved off the target

- **WHEN** the user presses on a button, drags off it and releases outside
- **THEN** the machine receives `PRESS.START` and `PRESS.END` and no `PRESS`

#### Scenario: Touch press turned into a scroll

- **WHEN** a touch press on a list item becomes a scroll and the browser fires
  `pointercancel`
- **THEN** the machine receives `PRESS.CANCEL` and no `PRESS`

### Requirement: Activation Bound To Click

Pointer activation SHALL be delivered from the `click` event, so assistive technology
that dispatches only `click` activates every pressable part. When no `click` follows a
pointer release (iOS and Android after a long touch), activation SHALL still be
delivered after a short fallback delay. A `click` classified as virtual SHALL produce
`PRESS.START`, `PRESS.END` and `PRESS` with `modality: "virtual"` in that order,
synchronously. Each physical or virtual activation SHALL produce exactly one `PRESS`.

#### Scenario: Pointer-only trigger handling (ZG#1664, BITS#2185)

- **WHEN** a screen reader activates a combobox trigger with a bare `click`
  (`detail: 0`, no `pointerdown`, `pointerup` or `keydown`)
- **THEN** the trigger sends one `PRESS` with `modality: "virtual"`

#### Scenario: DOM mutated between pointerup and click (RA#1513)

- **WHEN** the part re-renders between `pointerup` and `click`
- **THEN** exactly one `PRESS` is delivered

#### Scenario: VO+Space on a native button with a menuitem role (WebKit 228318)

- **WHEN** VoiceOver dispatches two `click` events for one VO+Space on a native button
  with `role="menuitem"`
- **THEN** exactly one `PRESS` is delivered (quirk entry)

### Requirement: Keyboard Activation

A focused button-like part SHALL start a press on Enter or Space keydown and activate
on the matching keyup. A link-like part SHALL activate on Enter only, and a native
checkbox or radio on Space only. Enter and Space inside a text-entry element SHALL NOT
press. Key repeat events SHALL NOT start or activate a press again. A native button
SHALL NOT activate twice for one key press (once from the key, once from the native
synthetic click).

#### Scenario: Held Space

- **WHEN** the user holds Space on a button long enough for key repeat and releases it
- **THEN** exactly one `PRESS` is delivered, on keyup

#### Scenario: Enter on a native button

- **WHEN** the user presses Enter on a pressable native `<button>`
- **THEN** exactly one `PRESS` is delivered with `pointerType: "keyboard"`

#### Scenario: Space on a link

- **WHEN** the user presses Space on a link-like part
- **THEN** no press is delivered

### Requirement: Lost Keyup While Meta Is Held

When a key press is in progress and Meta is held, releasing Meta SHALL end every
in-progress key press for which no keyup arrived, on platforms where the browser drops
those keyups (Chromium 1393524, WebKit 55291, Mozilla 1299553). The press SHALL end
with `data-pressed` removed and one `PRESS` carrying `metaKey: true`. This SHALL be a
quirk entry.

#### Scenario: ⌘ held during a Space press on macOS

- **WHEN** on macOS the user presses Space on a button while holding ⌘, releases Space,
  then releases ⌘, and the browser never fires Space's keyup
- **THEN** on ⌘'s keyup the press ends, `data-pressed` is removed and one `PRESS` with
  `metaKey: true` is delivered

### Requirement: Touch Press Behaviour

During a touch press rind-ui SHALL release implicit pointer capture so leaving the
part can cancel, SHALL hit-test using the contact area, SHALL prevent text selection
on the pressed part for the duration of the press (on iOS on the whole document,
restored shortly after release without races between overlapping presses), and SHALL
remove the double-tap delay with `touch-action: pan-x pan-y pinch-zoom` injected once
per document through the document style injection helper (with the environment's CSP
nonce; `platform-and-preferences` → "Document Style Injection"), never `manipulation`,
which stops `pointercancel` on scroll in Safari (WebKit 240917).

#### Scenario: Leaving a touched button

- **WHEN** a touch press starts on a button and the finger slides off it
- **THEN** `data-pressed` is removed and releasing does not activate

#### Scenario: Text selection restored

- **WHEN** two touch presses overlap on iOS and both end
- **THEN** the document's original `user-select` value is restored exactly once

### Requirement: Press Ends On Focus Loss Or Hidden Document

A press in progress SHALL end when the pressable part loses focus (a `blur` of the part,
for a part that had focus) or when the document becomes hidden (`visibilitychange` with
`document.visibilityState === "hidden"`: a tab or app switch during the press). The press
SHALL end with `PRESS.CANCEL`, no `PRESS` SHALL be delivered for it (neither from a later
keyup, `pointerup` or `click` nor from the click fallback), and `data-pressed` SHALL be
removed. This applies to pointer and keyboard presses alike. Without it a link that opens a
new tab with Enter, or a button whose keyup is lost to a tab switch, stays `data-pressed`
(react-spectrum#6094).

#### Scenario: Enter opens a new tab (react-spectrum#6094)

- **WHEN** the user presses Enter on a link-like part, the document becomes hidden before
  the keyup, and the keyup never arrives
- **THEN** the machine receives `PRESS.START` and `PRESS.CANCEL` and no `PRESS`, and the
  part no longer carries `data-pressed`

#### Scenario: Focus moves away during a held Space

- **WHEN** the user holds Space on a button and focus moves to another element before
  Space is released
- **THEN** the machine receives `PRESS.CANCEL`, `data-pressed` is removed, and releasing
  Space delivers no `PRESS`

#### Scenario: Tab switch during a touch press

- **WHEN** a touch press is in progress on a button and the document becomes hidden
- **THEN** the machine receives `PRESS.CANCEL` and no `PRESS`, even if a `pointerup` or
  `click` arrives when the document is shown again

### Requirement: Touch Context Menu Suppression Without Long Press

A pressable part SHALL be able to opt into suppressing the touch context menu while a
press is held (press option `suppressTouchContextMenu: true`), without opting into long
press. While a touch press on such a part is in progress, the `contextmenu` event it
triggers SHALL be prevented; no `LONG_PRESS` SHALL be sent, no long-press hint SHALL be
referenced, and the press events (including the `PRESS` on release) SHALL be unchanged.
A `contextmenu` from a mouse, pen or the keyboard SHALL NOT be prevented. Parts held for
longer than the long-press threshold that are not long-pressable use it (stepper
auto-repeat in Number Input).

#### Scenario: Held stepper on touch

- **WHEN** the user keeps a finger on a stepper declared with `suppressTouchContextMenu:
  true` for 800 ms and the platform fires `contextmenu`
- **THEN** the event is prevented, the context menu does not open, no `LONG_PRESS` is
  sent, the part has no long-press hint in its description, and releasing delivers the
  press events as for a short press

#### Scenario: Mouse context menu unaffected

- **WHEN** the user right-clicks the same stepper with a mouse
- **THEN** the `contextmenu` event is not prevented

### Requirement: Press Without Focus

A pressable part SHALL be able to declare that pressing it does not move focus; such a
part SHALL activate while focus stays where it was.

#### Scenario: Stepper button

- **WHEN** the user clicks a number field's increment button declared as not taking
  focus
- **THEN** the press activates and focus stays in the number field's input

### Requirement: Label Activation

A pressable part SHALL accept the press option `labelActivation: "focus" | "activate"`
(default `"activate"`). A `click` forwarded to the part by a label associated with it (the
native activation of a `<label>` whose `control` is the part, or a label's forwarding to
a non-labelable part) SHALL focus the part through the
safe focus operation. With `"activate"` it SHALL then activate as any `click` does,
with exactly one `PRESS`; with `"focus"` it SHALL send no press event. Popup triggers
that stand in for a native `<select>` declare `"focus"`, because a label click that
opens the popup is unexpected (radix#3679, headlessui#3787). A direct press on the part
SHALL behave the same with either value.

#### Scenario: Label click on a popup trigger (radix#3679, headlessui#3787)

- **WHEN** the user clicks the label of a trigger declared with `labelActivation:
  "focus"`
- **THEN** the trigger is focused and its machine receives no `PRESS`

#### Scenario: Label click on a default part

- **WHEN** the user clicks the label of a pressable part with the default option
- **THEN** the part is focused and its machine receives exactly one `PRESS`

#### Scenario: Direct click on a focus-only trigger

- **WHEN** the user clicks the trigger declared with `labelActivation: "focus"` itself
- **THEN** its machine receives one `PRESS`

### Requirement: Long Press

A part SHALL be able to opt into long press: holding a pointer or touch press for a
threshold (default 500 ms, scheduled through the injected scheduler) SHALL send
`LONG_PRESS` with `modality` and SHALL suppress the trailing `PRESS` and the touch
context menu. A long-pressable part SHALL reference a localised hint through
`aria-describedby`. Every long-press action in a contract SHALL have a keyboard twin,
as every pointer action does.

#### Scenario: Long press on touch

- **WHEN** the user keeps a finger on a long-pressable part for 500 ms and releases
- **THEN** the machine receives `LONG_PRESS` and no `PRESS`, and the platform context
  menu does not open

#### Scenario: Fake timers

- **WHEN** a test with fake timers starts a press and advances 500 ms
- **THEN** `LONG_PRESS` is delivered with no real time elapsed

#### Scenario: Hint

- **WHEN** a long-pressable part renders
- **THEN** its accessible description contains the hint from its `messages`

### Requirement: Hover

A part SHALL be able to opt into hover: `HOVER.START` and `HOVER.END` SHALL be sent
and `data-hover` set only for `pointerType` `mouse` or `pen`. Touch input SHALL never
produce hover, including the emulated `mouse` pointer events iOS fires after a touch
(WebKit 214609, quirk entry).

#### Scenario: Tap does not hover

- **WHEN** the user taps a tooltip trigger on a touch screen
- **THEN** no `HOVER.START` is sent and the trigger never carries `data-hover`

#### Scenario: Emulated mouse after touch on iOS

- **WHEN** iOS fires `pointerenter` with `pointerType: "mouse"` right after a touch on
  the same element
- **THEN** no `HOVER.START` is sent

