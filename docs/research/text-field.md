# Text Field — research

Status: done · Wave: 1 (Input / Textarea; the first control that implements `field-control`;
its autosize module is reused by Prompt Input and Editable)

Read [field.md](field.md) first (labels, description, error, validation). Cross-cutting:
[accessibility.md](accessibility.md) §6 (IME is a machine guard), §7 (announcer: counts are
keyed and debounced), [native-platform.md](native-platform.md) §11 (`field-sizing:
content`: use with fallback). Reado: `atoms/Input.tsx` (leading icon, trailing clear
button), `atoms/Textarea.tsx` (Cmd/Ctrl+Enter submit, Escape cancel),
`organisms/settings/fields.tsx` (a wrapping `<label>`).

## Pattern

- No APG pattern; native `<input type=text|email|url|tel|password|search>` (role
  `textbox`, `searchbox` for `type=search`) and `<textarea>` (role `textbox`, implicit
  multi-line). Native semantics give name, value, `required`, `readonly`, `disabled`,
  `maxlength`/`minlength`/`pattern` constraints, autofill, undo, IME, spellcheck,
  bfcache/tab restore and form reset.
- Keyboard: native editing. Enter in a single-line input performs implicit submission;
  Enter in a textarea inserts a newline.
- WCAG: 1.3.5 Identify Input Purpose (`autocomplete` passes through), 3.3.2 (visible label
  or instructions; placeholder is not a label), 4.1.3 (a character count that changes is a
  status message when it matters).

## How the others built it

### React Aria (`useTextField.ts`, RAC `TextField.tsx`/`TextArea.tsx`, Spectrum `TextArea.tsx`)

- `useControlledState` value (so the input is always controlled — RA#6601: tab restore
  lost), `useFormReset` (default captured at mount — RA#6830), `useFormValidation`, every
  native attribute forwarded (`maxLength`, `pattern`, `autoComplete`, `enterKeyHint`,
  composition handlers…), `inputElementType` input/textarea. `onChange(value)` without the
  event (RA#3247). Spectrum's TextArea autosizes: `height: auto` then `scrollHeight +
  (offsetHeight - clientHeight)`, skipping `overflow: hidden` in Firefox (bmo 1787062).
  RAC's TextArea does not autosize.

### Base UI (`input/Input.tsx` = `Field.Control`, `field/control/FieldControl.tsx`)

- Native `<input>`; uncontrolled passes `defaultValue` (BU#5880), controlled `value`;
  `onValueChange(value, details)` with cancel; dirty/filled from the change event (BU#5765:
  `data-filled` stale after a reset). No textarea, **no autosize** ("auto-sizing can be
  handled natively with `field-sizing`", BU#160/#164/#168), no clear part (BU#4643).

### Ark / Zag (`field/field-textarea.tsx`, `zag/packages/utilities/auto-resize`)

- `Field.Input`/`Field.Textarea autoresize`; `autoresizeTextarea` measures in rAF, listens
  to `input`, form `reset`, font `loadingdone`, a `ResizeObserver`, a `MutationObserver` on
  `rows`/`placeholder`, honours `max-height` by switching `overflow-y` — and **overrides the
  `value` setter** to resize on programmatic writes, which broke controlled React textareas
  (ZG#3204, ZG#2924). ZG#2281 ResizeObserver loop; ZG#2312 DPI rounding.

### Headless UI (`input/input.tsx`, `textarea/textarea.tsx`)

- Thin: id/labelledby/describedby from `Field`, `invalid` → `aria-invalid`, focus/hover
  render props. Autosize declined (HUI#241).

### Kobalte (`text-field/*`)

- Root with value, Label, Input, TextArea (`autoResize` same measure as Spectrum,
  `submitOnEnter` + `aria-multiline="false"`), Description, ErrorMessage. KB#737: writes
  `.value` during composition (Japanese IME broken, open).

## Accessibility

- **Name**: native `<label for>` (Field.Label); placeholder never the name (it disappears
  and has poor contrast); a dev warning when no name source exists.
- **Description/error**: `field-control` (describedby, `aria-invalid` only while
  displayed).
- **IME** (accessibility.md §6, `keyboard-interactions` IME guard): never write `.value`,
  move the selection or announce during composition (KB#737, AK#6663, BU#5091); every
  Text Field key handler that acts (ClearTrigger shortcut, Escape) is guarded. Do **not**
  suppress `onValueChange` during composition — Android Chrome reports composition for
  ordinary Latin typing and gating breaks controlled inputs (RA#8506, abandoned PR #8551);
  details carry `isComposing` instead, and validation / counting wait for
  `compositionend`.
- **Clear trigger**: a `button` named by `messages.clear` ("Clear"), out of the tab order
  (`tabIndex=-1`; keyboard users select and delete; Search Field adds Escape), pressing it
  does not take focus from the input (press without focus), focus stays/returns to the
  input, hidden (not rendered) when empty, disabled or read-only. A visible ✕ needs ≥ 24×24
  px (2.5.8).
- **Character count**: the visible count is not a live region; the Text Field announces
  remaining/over-limit through the Announcer, polite, keyed per field (coalesced: only the
  last count after a pause is spoken), only while the input is focused, not during
  composition, and only once the remaining count reaches the threshold (GOV.UK character
  count pattern: announce near and over the limit, not on every key). The count is also in
  the input's description (`aria-describedby`) so it is read on focus.
- **Soft vs hard limit**: native `maxlength` silently truncates pastes and input past the
  limit (users don't notice); `CharacterCount max` alone is a soft limit that lets the user
  type over and reports `tooLong` through Field (custom validity). Both are offered;
  counting matches what the browser enforces (UTF-16 code units, newline as 1 — WebKit
  counted `\r\n` as 2 until Safari 17.1, RA#1907) unless a `count` function is given.
- **Autosize**: no AT impact; avoid layout jumps under reduced motion (no animation).
- **Forced colors**: the field border must stay visible (`CanvasText`/`FieldText`).

## Bug history

All issues read, open and closed.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| React Aria | [react-spectrum#8506](https://github.com/adobe/react-spectrum/issues/8506) | `onChange` on every IME step | no composition gating | closed, won't fix (gating broke Android Latin typing) | don't gate `onValueChange`; gate side effects |
| React Aria | [react-spectrum#10249](https://github.com/adobe/react-spectrum/issues/10249) | SearchField drops characters with a Korean/Japanese IME | Enter/Escape handled without `isComposing` | closed (PR #10200) | every acting key handler uses the IME guard |
| Kobalte | [kobalte#737](https://github.com/kobaltedev/kobalte/issues/737) | Japanese `tesuto` → `てｓうｔお` | `.value` written back during composition | open | never write `.value` while composing |
| Base UI | [base-ui#5366](https://github.com/mui/base-ui/issues/5366) | focusable-disabled input still accepts IME text | blocked only `keydown` | open | focusable-disabled = `readOnly` + `aria-disabled`, not keydown |
| Base UI | [base-ui#5091](https://github.com/mui/base-ui/issues/5091) | Safari IME doubles text in OTP | value rewrite during composition | closed (PR #5098) | Safari + IME browser test |
| Base UI | [base-ui#699](https://github.com/mui/base-ui/issues/699) | Escape while composing closed the dialog | dismiss ignored `isComposing` | closed | dismissable-layer must ignore composing Escape (already IME guard) |
| Ariakit | [ariakit#6663](https://github.com/ariakit/ariakit/issues/6663) | Korean syllable aborted | selection moved mid-composition | closed (PR #6664) | no programmatic selection while composing |
| Ariakit | [ariakit#6916](https://github.com/ariakit/ariakit/issues/6916) | stale selection restored over the user's caret | async write restored an old range | closed (PR #6923) | no programmatic value writes except Clear and reset |
| React Aria | [react-spectrum#3247](https://github.com/adobe/react-spectrum/issues/3247) | `onChange(value)` has no event, caret-preserving formatting impossible | API | open | `onValueChange(value, details)` with `details.event` |
| Zag | [zag#3204](https://github.com/chakra-ui/zag/issues/3204) | autoresize breaks controlled React textareas | overrode the `value` setter and re-dispatched `input` | closed (PR #3206) | never patch `value`; never synthesize `input` on programmatic writes |
| Zag | [zag#2924](https://github.com/chakra-ui/zag/issues/2924) | after a JS clear, typing the same char emits no change | setter interception confused React's value tracker | closed | same |
| Zag | [zag#2281](https://github.com/chakra-ui/zag/issues/2281) | "ResizeObserver loop" with an autoresize textarea in a Drawer | resized the observed element in its own callback | closed | write the height in the next frame; prefer `field-sizing` |
| Zag | [zag#2312](https://github.com/chakra-ui/zag/issues/2312) | height off by a pixel at fractional DPI | `parseInt` of border widths | closed | `parseFloat` / `offsetHeight - clientHeight` |
| Kobalte | [kobalte#484](https://github.com/kobaltedev/kobalte/issues/484) | no resize when the value is set externally | resize tracked only input events | closed (usage) | resize on every value commit, from the machine's value |
| Base UI | [base-ui#160](https://github.com/mui/base-ui/issues/160) / [#164](https://github.com/mui/base-ui/issues/164) / [#168](https://github.com/mui/base-ui/issues/168) | TextareaAutosize glitches, crash on window resize after unmount | JS measurement races | closed; not shipped | `field-sizing: content`; JS fallback feature-detected, unmount-safe |
| Headless UI | [headlessui#241](https://github.com/tailwindlabs/headlessui/issues/241) | autosize request | — | closed, declined | autosize is CSS-first |
| React Aria | [react-spectrum#1907](https://github.com/adobe/react-spectrum/issues/1907) | textarea `maxLength=10` allowed ~7 in Safari | WebKit counted `\r\n` as 2 | closed (Safari 17.1) | count like the browser; newline = 1 |
| React Aria | [react-spectrum#2330](https://github.com/adobe/react-spectrum/issues/2330) | description → error swap left `aria-describedby` dangling | slot id validated on mount only | closed (PR #2332) | recompute describedby on every part mount/unmount |
| React Aria | [react-spectrum#2681](https://github.com/adobe/react-spectrum/issues/2681) | textarea lost focus when an error appeared | a wrapper node remounted the control | closed | showing/hiding parts never re-parents the control |
| Kobalte | [kobalte#534](https://github.com/kobaltedev/kobalte/issues/534) | error id appended to `aria-labelledby` | wiring choice | open | errors only in describedby |
| React Aria | [react-spectrum#8995](https://github.com/adobe/react-spectrum/issues/8995) | TextArea flashes `defaultValue` after a `useActionState` submit | internally controlled value vs React's form reset | closed | uncontrolled = DOM-owned (`defaultValue`) |
| Base UI | [base-ui#5880](https://github.com/mui/base-ui/issues/5880) | warning when `defaultValue` changes on an uncontrolled control | `useControlled` warning | closed (PR #5881) | pass `defaultValue` through; reset restores the latest default |
| Base UI | [base-ui#5765](https://github.com/mui/base-ui/issues/5765) | reset clears the input but `data-filled` stays | filled updated only on change | open | re-read the value on `reset` |
| Base UI | [base-ui#4643](https://github.com/mui/base-ui/issues/4643) | no clean clear button with `onValueChange` | no part | open | ClearTrigger through the same change path, reason `CLEAR`, focus stays on the input |
| Base UI | [base-ui#3819](https://github.com/mui/base-ui/issues/3819) | uncontrolled control re-renders on every key | `setDirty`/`setFilled` each key | closed (PR #3820) | derived flags change only on transitions; parts select slices |
| Base UI | [base-ui#3172](https://github.com/mui/base-ui/issues/3172) | `autoFocus` input lacks `data-focused` on first render | focus before handlers attached | closed (PR #3871) | seed focus from `activeElement` at start |
| React Aria | [react-spectrum#6601](https://github.com/adobe/react-spectrum/issues/6601) | uncontrolled TextField loses its value on tab restore | always controlled internally | closed, won't fix | truly uncontrolled native input |
| Base UI | [base-ui#4809](https://github.com/mui/base-ui/issues/4809) | autofill changed a read-only/disabled control | ingest path unguarded | closed (PR #4810) | every value ingest respects disabled/readOnly (native input does) |
| Radix | [primitives#3550](https://github.com/radix-ui/primitives/issues/3550) | paste overflows the OTP length | no clamp on paste | closed (PR #3551) | (hard limit) native `maxlength` clamps paste |
| Radix | [primitives#3493](https://github.com/radix-ui/primitives/issues/3493) | `type="password"` not applied | prop not forwarded | closed (PR #3510) | forward every native attribute |
| React Aria | [react-spectrum#1178](https://github.com/adobe/react-spectrum/issues/1178) | `rows`/`cols` dropped for a textarea | input-only allowlist | closed | pass unknown native props through |
| Kobalte | [kobalte#627](https://github.com/kobaltedev/kobalte/issues/627) | controlled field starting `value=undefined` never updates | controlled-ness frozen as uncontrolled | open | controlled iff defined at creation; dev warning on switch (runtime rule) |
| Kobalte | [kobalte#413](https://github.com/kobaltedev/kobalte/issues/413) | `setValue(undefined)` left a character | stale DOM value | closed (PR #456) | controlled `null` renders `""` |
| Ark | [ark#3727](https://github.com/chakra-ui/ark/issues/3727) | controlled `undefined` rendered "undefined" (Solid) | coerced to string | closed | same |
| Kobalte | [kobalte#459](https://github.com/kobaltedev/kobalte/issues/459) | input shows "[object Event]" | `onChange` gets an Event, used as value | closed (usage) | `onValueChange` distinct from native `onChange` |
| Ark | [ark#4180](https://github.com/chakra-ui/ark/issues/4180) | Vue input cleared native `defaultValue`; FormData empty | wrapper wrote an empty value on mount | closed (PR #4197) | never write a value on mount when uncontrolled |
| Ark | [ark#3581](https://github.com/chakra-ui/ark/issues/3581) | hydration mismatch on Field.Input | unstable ids | closed | `element-ids` |
| React Aria | [react-spectrum#6504](https://github.com/adobe/react-spectrum/issues/6504) | iOS shake-to-undo does nothing | programmatic value writes wipe the undo stack | closed, won't fix | keep programmatic writes to Clear/reset; Clear uses `setRangeText` where undo matters (documented) |

## Known pitfalls

- Programmatic `.value` writes: React's value tracker, undo stack, caret, IME. The only
  writes rind makes are Clear and (controlled) parent changes, which React performs.
- `field-sizing: content` with no `min-block-size` collapses an empty textarea to one line;
  `rows` is ignored by `field-sizing` — the theme maps `rows` to `min-block-size` via
  `--rind-text-field-rows` (set inline from `rows`).
- Newline counting differs between the DOM value (`\n`) and submission (`\r\n`): a server
  limit of N chars sees N + newlines. Documented.
- `type="number"` is not a Text Field (Number Input, later); `type="search"` changes the
  role to `searchbox` (Search Field, later).

## Testing notes

- IME: the a11y-test-tooling adapter inputs include composing keys; a browser test drives
  `compositionstart` / `input` (isComposing) / `compositionend` and asserts no announce, no
  validation, value intact.
- Autosize: browser mode only (layout); jsdom asserts the attribute/inline style chosen.
- Driver `getTextField(screen, { name })`: `type`, `fill`, `clear` (ClearTrigger; keyboard
  twin select-all + Backspace), `blur`, `compose`; queries `value`, `isInvalid`,
  `errors`, `description`, `characterCount`, `isDisabled`, `isReadOnly`, `isRequired`.

## Decisions

- **Parts**: `TextField.Root` (`div`; is a `Field.Root` when not already inside one),
  `Label`, `Input` (`input`) or `Textarea` (`textarea`) — exactly one —, `Description`,
  `ErrorMessage` (the Field parts under scope `text-field`), `ClearTrigger` (`button`),
  `CharacterCount` (`span`). Leading/trailing adornments are the consumer's markup.
- **Value**: controllable `value`/`defaultValue`/`onValueChange(value, details)`;
  `details.reason` `INPUT | CLEAR | RESET`, `details.event`, `details.isComposing`.
  Uncontrolled renders `defaultValue` and leaves the DOM in charge (autofill, tab restore,
  React action reset); the machine mirrors the value from `input` events and re-reads it on
  `reset`.
- **Machine**: `idle` | `composing`; events `INPUT {value, composing}`,
  `COMPOSITION.START`, `COMPOSITION.END {value}`, `CLEAR`, `RESET`, `FOCUS`, `BLUR`.
- **Autosize**: `Textarea autosize` → capability `autosize-textarea` (`core/dom/autosize.ts`):
  `field-sizing: content` inline when supported, else measure on value commit, width
  resize and font load, height written in the next frame, `max-block-size` honoured; never
  patches `value`, never dispatches events. Reused by Prompt Input and Editable.
- **Character count**: `CharacterCount` with `max` (soft) or the Input's `maxLength`
  (hard), `count` function, announcement threshold.
- **Not in scope**: Search Field (Escape clears, `searchbox`), Password Input, Number
  Input, Prompt Input's submit-on-Enter, Reado's Cmd/Ctrl+Enter (a docs recipe).

## Open questions

- Default announcement threshold for the count: GOV.UK shows it from 75%; we announce when
  `remaining <= max(10, 20% of max)` and every time over the limit. Revisit with users.
</content>
</invoke>
