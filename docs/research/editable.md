# Editable — research

Status: done · Wave: 3

An Editable is inline edit-in-place text: a value shown as plain text (the preview) that turns
into an `input` or `textarea` when the user activates it, then goes back to text when the edit is
submitted or cancelled. Think of a page title, a table cell, a task name, a profile field. Only
two of the nine libraries ship one: Ark/Zag (`editable`) and Reka UI (`Editable`, ported from
Radix Vue). Chakra v2 had one, and Chakra v3 re-exports Ark's. Radix, Base UI, Headless UI,
Ariakit, React Aria, Bits UI and Kobalte have none (no component, no open request found,
2026-10-26). The component is small; what goes wrong is the edges: which value Escape restores,
who owns focus when the preview and the input swap, and what counts as "outside" for
submit-on-blur. This note records both implementations, the bug history of each, and the
decisions for `add-editable`.

Builds on [text-field.md](text-field.md) (its `autosize` module is reused here), [field.md](field.md),
[button.md](button.md), [dialog.md](dialog.md) (the reason-carrying `onOpenChange` and the
dismiss/outside rules), and the cross-cutting notes [accessibility.md](accessibility.md) §2 (names),
§4.3 (focus restore), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
causes A, D, H, and [native-platform.md](native-platform.md) (`field-sizing`, IME composition).

Sources read (local shallow clones, 2026-10-26):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/editable/src/{editable.machine,editable.connect,editable.dom,editable.types,editable.anatomy,editable.props}.ts`, `CHANGELOG.md` (1.46.0 at read time) |
| Reka UI | `reka-ui/packages/core/src/Editable/{EditableRoot,EditableInput,EditablePreview,EditableArea,EditableEditTrigger,EditableSubmitTrigger,EditableCancelTrigger}.vue`, `Editable.test.ts` |
| Trackers | chakra-ui/zag and chakra-ui/ark (search "editable"), unovue/reka-ui (search "editable"); issues marked "title only" were not opened |
| Platform | `<input>`, `<textarea>`, `maxlength`, `CompositionEvent` / `KeyboardEvent.isComposing`, `field-sizing: content`, `inputmode` |

## Pattern

- WAI-ARIA APG: **none**. There is no "inline edit" pattern. The component is two native
  controls that take turns: a button-like preview and a text input (APG
  [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) for the preview and the three
  triggers; the input is a plain textbox with no ARIA of its own).
- WCAG 3.2.1 (On Focus): "when any user interface component receives focus, it does not
  initiate a change of context". Both libraries default `activationMode` to `focus`, so merely
  tabbing onto the preview swaps it for an input and moves focus. Entering an edit state is
  arguably not a change of context, but Tab-through-a-form then submits or cancels every field it
  crossed (submit-on-blur), which is why the default here must not be `focus`.
- WCAG 2.1.1 / 2.5.1: a `dblclick` activation is pointer-only. Keyboard users need an
  activation that works whatever the pointer mode is.
- WCAG 3.3.1 / 3.3.3: an invalid draft must be reported (`aria-invalid`, the field's error
  wiring) and the user must be able to stay in edit mode to fix it.
- The input needs an accessible name. Zag names it `aria-label="editable input"` and
  `aria-labelledby` the Label, so the label wins when rendered; zag#3495 says the announced name
  was still the English string (title and first lines read).
- Names change when preview and input swap: the preview is named by what it shows (its value),
  the input by the label. Both are legitimate; the preview naming itself "edit" (below) is not.

## How the others built it

### Zag / Ark

- **Anatomy**: `root`, `area`, `label`, `preview`, `input`, `control`, `editTrigger`,
  `submitTrigger`, `cancelTrigger`.
- **Props**: `value` / `defaultValue` / `onValueChange`, `edit` / `defaultEdit` /
  `onEditChange`, `activationMode: "focus" | "dblclick" | "click" | "none"` (default `focus`),
  `submitMode: "enter" | "blur" | "both" | "none"` (default `both`), `selectOnFocus` (true),
  `maxLength`, `placeholder: string | { edit, preview }`, `autoResize`, `disabled`,
  `readOnly`, `required`, `invalid`, `name`, `form`, `finalFocusEl`, `translations`
  (`input`, `edit`, `submit`, `cancel`), and `onValueCommit` / `onValueRevert`.
- **States**: `preview` and `edit`. `EDIT` enters; `SUBMIT` and `CANCEL` leave. `previousValue`
  is saved on entering and restored on `CANCEL` (`revertValue`). Controlled `edit` goes through
  `CONTROLLED.EDIT` / `CONTROLLED.PREVIEW` events and a `previousEvent` marker to tell a submit
  from a cancel.
- **The value is the live draft.** `context.value` changes on every keystroke
  (`VALUE.SET` from the input's `onChange`) and `onValueChange` fires per keystroke; cancel
  writes the old value back. `onValueCommit` is the committed one.
- **Outside**: while editing, `trackInteractOutside` on the input, excluding the submit and
  cancel triggers. An outside interaction sends `SUBMIT` when `submitMode` is `both` or `blur`,
  otherwise `CANCEL`. After leaving, focus goes to `finalFocusEl` or the edit trigger, unless the
  outside target was itself focusable (`focusable`), so a click on another field is not stolen.
- **Keyboard on the input**: Escape cancels. Enter submits an `input`; for a `textarea`, Cmd/Ctrl
  + Enter submits and plain Enter is a newline. Composition events are skipped
  (`isComposingEvent`).
- **Preview**: a `span` with `tabIndex=0`, `aria-label="edit"`, `hidden` while editing (or
  `visibility: hidden` with `autoResize`). Click, focus or double click enters edit by mode.
  The `aria-label` replaces the text content as the name, so the value is not in the name.
- **Auto resize**: the Area becomes `display: inline-grid`; preview and input share one grid
  cell; the hidden one gets `visibility: hidden`, so the box is as wide as the longer of the two.
- **Hidden triggers**: edit trigger `hidden` while editing; submit and cancel `hidden` while
  not.

### Reka UI (from Radix Vue)

- **Parts**: `Root`, `Area`, `Preview`, `Input`, `EditTrigger`, `SubmitTrigger`,
  `CancelTrigger`. `Root` renders a `VisuallyHiddenInput` when inside a form.
- **Props**: `modelValue` / `defaultValue`, `startWithEditMode`, `activationMode`
  (`focus | dblclick | none`, default `focus`), `submitMode` (`blur | enter | none | both`,
  default `blur`), `selectOnFocus` (false), `autoResize`, `maxLength`, `readonly`,
  `disabled`, `placeholder`, `name`, `required`. Emits `update:modelValue`, `submit`,
  `update:state` (`edit | submit | cancel`).
- **Two values**: `modelValue` is the committed value; `inputValue` is the draft. `submit()`
  copies draft to model; `cancel()` only leaves edit mode. The draft is re-synced from the model
  when edit starts.
- **Outside**: `usePointerDownOutside` and `useFocusOutside` from DismissableLayer, enabled by
  `isEditing`. Outside: `submit()` for `blur` / `both`, `cancel()` otherwise.
- **Input**: `aria-label="editable input"` (hard-coded), `hidden` unless editing, handles
  Enter (not Shift, not Meta, not composing) and Escape.
- **No textarea support in the keyboard code**: Enter always submits unless Shift or Meta is
  held (reka-ui#1044 asked for textarea support, closed).

### Differences that matter

| | Zag | Reka |
|---|---|---|
| Value on change | live draft is the value | committed `modelValue` + separate draft |
| Default `submitMode` | `both` | `blur` |
| Default `activationMode` | `focus` | `focus` |
| Textarea | Cmd/Ctrl+Enter submits | Enter submits, Shift+Enter breaks (no real support) |
| Preview name | `aria-label="edit"` | none set (content is the name) |
| Name of input | label if rendered, else English string | English string always |
| Form value | the input (`name`, `form`) | `VisuallyHiddenInput` on Root |

## Bug history

Zag/Ark entries come from the issue titles and bodies (opened where "read"), the machine source
and `CHANGELOG.md`; Reka entries from issue bodies read on 2026-10-26.

| Bug | Where | Cause | Decision |
|---|---|---|---|
| Escape keeps the edited value when the initial value is empty or the panel starts in edit mode | [zag#3510](https://github.com/chakra-ui/zag/issues/3510) (read), fixed 2026-10 | Not established in the issue text | The value to restore is captured on **entering** edit (including the mount in `defaultEdit`), never inferred from emptiness or from props. A test covers both repros. |
| After deleting all text twice, cancel does not restore | [zag#2743](https://github.com/chakra-ui/zag/issues/2743) (read), fixed 1.26.0 | The reverted value equalled the stale one, so no change was seen | Revert writes the saved value and the input's `value` property directly, even when the machine's value did not change. |
| Resetting to the previous value when leaving edit does not work well | [zag#658](https://github.com/chakra-ui/zag/issues/658) (read), closed 2023 | Not established | Same: one saved committed value, one revert path. |
| Cannot delete text when `maxLength` is reached | [zag#1228](https://github.com/chakra-ui/zag/issues/1228) (read), closed 2024 | Not established | `maxLength` is the native attribute on the input; no handler slices the draft. |
| Input named "editable input" instead of the rendered label | [zag#3495](https://github.com/chakra-ui/zag/issues/3495) (read), closed 2026-10 | Hard-coded English `aria-label` | The input is named by the Label (`for` / `aria-labelledby`); with no Label, by `messages.input`, never both. |
| Not truly controlled: `value` only affects the preview | [zag#2703](https://github.com/chakra-ui/zag/issues/2703) (read), closed 2025-09 | The input kept its own value | The draft is controllable state with a cancelable `onDraftChange`: a consumer can reject or reformat keystrokes and paste. |
| Submit on blur does not work when the editable is conditionally rendered | [zag#721](https://github.com/chakra-ui/zag/issues/721) (read), closed 2023 | Not established | Outside tracking is an effect of the `edit` state, installed on entering it, never at mount. |
| Virtual keyboard not always opened on mobile | [zag#292](https://github.com/chakra-ui/zag/issues/292) (read), closed 2022 | Not established. iOS only opens the keyboard when `focus()` runs inside the user gesture | See Open questions: the focus call must not wait for a frame. |
| Submit-on-blur does not fire after clicking another Editable | [reka-ui#3044](https://github.com/unovue/reka-ui/issues/3044) (read), **open** | Not established | The outside rule treats a press on another focusable (an Editable's preview) as the outside press that submits **and** lets focus go there. A test with two Editables. |
| `both` submit mode did not submit on blur | [reka-ui#1022](https://github.com/unovue/reka-ui/issues/1022) (read), closed 2024 | Blur reverted instead of submitting | One table maps each `submitMode` to the outside outcome (below); tested per mode. |
| Space submits when `submitMode` is `enter` | [reka-ui#1008](https://github.com/unovue/reka-ui/issues/1008) (read), closed 2024 | `@keydown.enter.space` handler | Only Enter submits. Space is text. |
| `submit` event emitted on every click anywhere | [reka-ui#1036](https://github.com/unovue/reka-ui/issues/1036) (read), closed 2024 | Outside handler ran while not editing | `onValueChange` fires only on a real change of the committed value from a submit. |
| Pointer-down-outside work runs on every click | [reka-ui#1944](https://github.com/unovue/reka-ui/issues/1944) (read), closed 2025 | The listener was always installed | No listener outside the `edit` state (also zag#721). |
| Editable in a Popover opens in edit mode when the Popover opens | [reka-ui#1016](https://github.com/unovue/reka-ui/issues/1016) (read), closed 2024 | `activationMode: focus`: the popover moved focus onto the preview | Default `activationMode` is `click`; `focus` is opt-in and documented with this case. |
| Editable inside a Dialog does not submit unless the submit trigger is used | [reka-ui#1603](https://github.com/unovue/reka-ui/issues/1603) (read), closed 2025 | Not established (a layer around the Editable swallowing outside events) | The outside rule asks the layer stack: a press inside a higher overlay's content is not an outside press for this Editable, and the Editable inside a Dialog still gets its own. A test inside Dialog. |
| Controlled Editable sends a stale value on submit | [reka-ui#2277](https://github.com/unovue/reka-ui/issues/2277) (read), closed 2025-11 | The committed value was read before the parent's update | The submit event carries the draft; `onValueChange` details are built from the draft, not read back from props. |
| Hidden triggers can drop focus | Zag connect (no issue; read from source: `hidden` on edit, submit and cancel triggers) | `hidden` on a focused button | Focus is moved to the input or preview **before** the trigger is hidden (an ordering rule in the machine's action list). |
| Editable `user-select: none` with `autoResize` | [zag#2686](https://github.com/chakra-ui/zag/issues/2686) (title only) | Not read | The inline styles the component sets are listed in the spec; none touches `user-select`. |
| Loses `defaultValue` on cancel | [ark#2561](https://github.com/chakra-ui/ark/issues/2561) (title only) | Not read | Covered by the zag#3510 test. |

## Accessibility decisions

- **Preview**: a real `<button type="button">` whose content is the value (or the placeholder).
  Its name is the Label plus the value (`aria-labelledby` = label id + its own id), so a screen
  reader says "Display name, Ada Lovelace, button", never just "edit". Enter and Space always
  enter edit mode, whatever `activationMode` says (WCAG 2.1.1); the mode only changes which
  *pointer* gesture activates (`click` default, `dblclick`, `focus`, `none`).
- **Input**: named by the Label; description and error through the Field wiring
  ([field.md](field.md)); `aria-invalid` from `invalid`; `maxlength`, `required`, `name` on the
  **committed** value's hidden input, not on this one (a form posts the committed value
  while the preview shows; the draft is not posted).
- **Focus**: entering edit focuses the input synchronously inside the activating event and
  selects its text when `selectOnFocus` (default true; Zag true, Reka false). Leaving by Enter,
  Escape or the triggers returns focus to the preview (or `finalFocus`). Leaving by an outside
  press on a focusable element does not take focus back (cause D, Zag's `focusable` rule).
- **Announcements**: none. Focus returns to a preview whose name now contains the new value;
  that is the announcement. A rejected submit (`invalid`) is reported by the field's error
  message.
- **IME**: Enter while composing never submits; Escape while composing cancels the
  composition only (both from `KeyboardEvent.isComposing`).
- **Triggers** (`EditTrigger`, `SubmitTrigger`, `CancelTrigger`): buttons named from messages
  ("Edit", "Save", "Cancel"), localisable; the edit trigger is outside the edit flow's focus
  trap (there is none), so Tab from the input reaches Submit then Cancel in DOM order.
- **Reduced scope of `hidden`**: triggers that do not apply are `hidden`, but only after focus
  has moved off them.

## Decisions for `add-editable`

1. **Parts**: `Root`, `Label`, `Area`, `Preview` (`button`), `Input` (`input`; `render` as
   `textarea` for multiline), `Control` (group around the triggers), `EditTrigger`,
   `SubmitTrigger`, `CancelTrigger`. Only `Root`, `Preview` and `Input` are required.
2. **Machine**: states `preview | edit`. Context: committed `value` (controllable), `draft`
   (controllable, defaults to the value on entering edit), `saved` (the committed value at entry).
   Events: `EDIT { reason }`, `SUBMIT { reason }`, `CANCEL { reason }`, `DRAFT.CHANGE`,
   `VALUE.SYNCED` (controlled prop), `EDIT.SYNCED`. `reason` is `edit-trigger |
   preview-press | preview-dblclick | preview-focus | preview-key | enter-key | escape-key |
   outside-press | submit-trigger | cancel-trigger | api`, reported in `onEditChange` details,
   as Dialog reports its close reason.
3. **Props**: `value` / `defaultValue` / `onValueChange({ value, reason })` (the committed value,
   once per submit); `draft` / `onDraftChange({ draft })`, cancelable; `edit` / `defaultEdit` /
   `onEditChange({ edit, reason })`, cancelable (a veto keeps the user in edit mode, which is
   how a consumer validates); `activationMode` (`click` default); `submitMode` (`both` default);
   `selectOnFocus`; `placeholder: string | { edit, preview }`; `maxLength`; `autoResize`;
   `disabled`, `readOnly`, `required`, `invalid`; `name`, `form`; `dir`; `messages`; `finalFocus`.
4. **Outside table** (one function, tested per row): `submitMode` `both` and `blur` → submit;
   `enter` and `none` → cancel. A press inside the Submit or Cancel trigger is not outside.
   The window losing focus (tab switch) is not an outside event.
5. **Keys on the Input**: Enter submits an `input`; for a `textarea` Cmd/Ctrl+Enter submits and
   Enter is a newline; Escape cancels; none while composing.
6. **Autosize**: reuse core `dom/autosize.ts` (the Text Field module): `field-sizing: content`
   when supported, otherwise measured; the preview and input share one grid cell.
7. **Form value**: the core `dom/hidden-input.ts` carries the committed value (no `name` on the
   visible input).
8. **`data-*`**: `data-scope="editable"`, `data-part`, `data-state="preview|edit"` on every
   part, `data-empty`, `data-disabled`, `data-readonly`, `data-invalid`, `data-focus`,
   `data-focus-visible` on Preview and Input. No hover or focus *states* in the machine.
9. **Contract**: locate by the Label's text. Actions `edit`, `type(text)`, `submit`, `cancel`,
   `pressEnter`, `pressEscape`, `clickOutside`; queries `isEditing`, `value`, `draft`,
   `previewText`.
10. **Reuse**: Field wiring, `autosize`, `hidden-input`, the injected `Scheduler` for focus
    timing, the layer stack for the "inside a higher overlay" rule, `focus-restore`. No new `dom/`
    module.
11. **Non-goals**: rich text (a `contenteditable` editor is a different component), async pending
    state, validation rules, multiple linked fields, undo history beyond the native input's.

## Open questions

- **iOS keyboard** (zag#292): calling `input.focus()` after the preview unmounts or hides loses
  the user-gesture context on iOS Safari, and the keyboard does not open. Both parts are always
  mounted (preview and input share a grid cell), but the input must be focusable at the moment
  of the press, which `hidden` / `visibility: hidden` prevent. Needs a real iPhone check before
  deciding between `inert`-style hiding and a one-frame-late focus.
- **`activationMode: "focus"` and WCAG 3.2.1**: keep the option (both libraries ship it) or
  drop it? Kept for parity; the docs page will say it is not recommended inside forms.
- **Async submit**: a pending state (`data-pending`, `aria-busy`) while `onValueChange` returns a
  promise. Left to the consumer for now (veto through `onEditChange`).
- **Draft persistence on accidental outside press** (submit-on-blur loses nothing; cancel mode
  loses the draft). No undo in v1.
