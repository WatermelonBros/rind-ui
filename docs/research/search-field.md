# Search Field — research

Status: done · Wave: 2 (SearchField in React Aria; Kobalte's `Search` is a combobox variant)

A Text Field (`add-text-field`) with search semantics: `type="search"`, Escape clears,
Enter submits, a "Clear search" trigger. Read [text-field.md](text-field.md) and
[field.md](field.md). Suggestions are **Autocomplete** ([autocomplete.md](autocomplete.md)),
not this component. Cross-cutting: [accessibility.md](accessibility.md) §6 (IME guard),
§4.3 and [overlay-infrastructure.md](overlay-infrastructure.md) (Escape belongs to the
innermost consumer: the dismissable-layer spec already has the scenario "a search field
inside a dialog clears itself on Escape and calls `preventDefault()` → the dialog stays
open"). Reado: the search box built from `atoms/Input.tsx` with a leading icon and a
trailing clear button (Text Field's ClearTrigger story).

## Pattern

- No APG pattern. `<input type="search">` has the implicit role **`searchbox`** (HTML-AAM).
  The `search` landmark belongs to the surrounding form or `<search>` element
  ([Landmarks](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/)); a docs recipe, not a
  part.
- Native behaviour of `type=search`: Chromium and WebKit draw a cancel button
  (`::-webkit-search-cancel-button`) that clears and fires `input` (and the non-standard
  `search` event), and clear the field on Escape; Firefox draws none. Mobile keyboards show a
  "Search" key (`enterkeyhint="search"`).
- WCAG: 2.1.1 (clear by keyboard: Escape), 2.5.8 (clear target), 3.2.2 (typing does not
  navigate — searching on input is the consumer's choice).

## How the others built it

### React Aria (`react-aria/src/searchfield/useSearchField.ts`, `react-stately/.../useSearchFieldState.ts`, RAC `SearchField.tsx`)

- Text field with `type="search"` default (overridable), controllable `value`; Escape: if
  the value (state **and** the DOM value) is empty, `continuePropagation` (so an enclosing
  overlay closes — RA#5480), else `setValue("")` + `onClear`; Enter: `onSubmit(value)` and
  `preventDefault` when `onSubmit` is given (else native submission). Clear button:
  `aria-label` "Clear search" (localised), `excludeFromTabOrder`, `preventFocusOnPress`,
  focus to the input on press start (mobile keyboard stays), disabled when disabled or
  read-only. RAC: `data-empty` on the root; the clear button stays in the DOM, styled away
  by `[data-empty]`. Keyboard handlers ordered so Escape does not leak to a parent dialog.
- Problems: RA#10249 and RA#6421 (Enter/Escape not IME-guarded: Korean/Chinese/Japanese
  commits submitted or cleared), RA#5480 (Escape on empty should reach the overlay),
  RA#7265 (open: clear button does not re-validate), RA#2253 (consumer `onKeyDown` never
  called), RA#4141 (clear button in high contrast).

### Kobalte (`search/*`)

- `Search` = a combobox without filtering plus a debounced `onInputChange`
  (`debounceOptionsMillisecond`), an Indicator (loading) and NoResult — Autocomplete's
  territory (kobalte#585, #578). No plain search field.

### Others

- Ark, Radix, Base UI, Headless UI, Ariakit, Reka, Bits: none; consumers put
  `type="search"` on a Text Field/Input. Base UI#4643 (how to build a clear button that goes
  through `onValueChange`) is Text Field's ClearTrigger lesson.

## Accessibility

- Role `searchbox` from `type="search"` (no explicit role). Name from the Label (a visible
  label, or `aria-label` for an icon-only search box; placeholder is never the name).
- **Escape**: clears a non-empty, editable value through the change path, keeps focus,
  calls `preventDefault()` so an enclosing layer stays open; on an empty field it does
  nothing, so Escape reaches the layer (RA#5480). Guarded during composition (RA#10249).
- **Enter**: `onSubmit(value)`; native implicit submission is **not** prevented (a search
  form submits, as RA#2802 taught for Number Field); IME-guarded (RA#6421).
- **Clear trigger**: Text Field's ClearTrigger (out of the tab order, press without focus,
  rendered only when non-empty and editable), named `messages.clear` = "Clear search".
  Escape is its keyboard equivalent. The native cancel button is hidden while our trigger
  is mounted, so there is one clear control (injected style rule).
- **Announcement**: none by default; clearing keeps focus in the empty field, which the AT
  reads on the next interaction. (Open question.)
- **Forced colors / target**: Text Field's.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [RA#10249](https://github.com/adobe/react-spectrum/issues/10249) | CJK IME characters dropped on Enter/Escape | key handlers ignore composition | fixed | `keyboard-interactions` IME guard on both keys |
| RA | [RA#6421](https://github.com/adobe/react-spectrum/issues/6421) | Enter that commits an IME composition calls `onSubmit` | same | fixed (#6404) | same |
| RA | [RA#5480](https://github.com/adobe/react-spectrum/issues/5480) | Escape in an empty search field does not close the overlay | Escape always consumed | fixed | consume Escape only when it cleared something |
| RA | [RA#7265](https://github.com/adobe/react-spectrum/issues/7265) | clear button leaves a stale validation error | clear bypassed validation | open | clear goes through the change path (Text Field's ClearTrigger), Field re-validates |
| RA | [RA#2253](https://github.com/adobe/react-spectrum/issues/2253) | consumer `onKeyDown` never called | handler overwritten | closed | consumer handlers merged first (react-adapter) |
| RA | [RA#4141](https://github.com/adobe/react-spectrum/issues/4141) | clear button background overlaps border in high contrast | theme | closed | theme: transparent trigger, `currentColor` glyph |
| Base UI | [BU#4643](https://github.com/mui/base-ui/issues/4643) | users cannot build a clear button that reports a change | no clear part | open | ClearTrigger part |
| Kobalte | [kobalte#585](https://github.com/kobaltedev/kobalte/issues/585) / [#578](https://github.com/kobaltedev/kobalte/issues/578) | async search, modify input in Search | Search is a combobox | open | suggestions → Autocomplete; Search Field stays a field |
| Platform | WebKit/Chromium cancel button | two clear buttons with a custom one | native `::-webkit-search-cancel-button` | — | hide the native one while ClearTrigger is mounted |
| Platform | native Escape on `type=search` | value cleared outside the change path in controlled use | UA default action | — | `preventDefault()` when we clear |

## Known pitfalls

- Escape double duty (clear vs close layer).
- IME on Enter/Escape.
- Native cancel button plus a custom one; Firefox has none (consistency comes from our part).
- Debounced searching is the consumer's (or Autocomplete's) concern.

## Testing notes

- `escape` with empty and non-empty values inside a Dialog (layer stays/closes), `compose`
  then Enter (no submit), `submit` with and without a form, ClearTrigger by pointer and its
  keyboard twin Escape.

## Decisions

- **Built on Text Field** through the machine builder requested from `add-text-field`
  (preset events `ESCAPE` and `SUBMIT`; ClearTrigger reason `CLEAR` or `ESCAPE`). Parts: Text
  Field's (`Root`, `Label`, `Description`, `ErrorMessage`, `Input`, `ClearTrigger`), no
  Textarea, no CharacterCount by default.
- **Input**: `type="search"` (implicit `searchbox`), `enterKeyHint="search"` default.
- **Props**: Text Field's plus `onSubmit(value, details)`.
- **`data-*`**: Text Field's plus `data-empty` on Root and Input (RAC's selector).
- **Contract**: role `searchbox` + name; actions `type`, `fill`, `clear` (pointer:
  ClearTrigger; keyboard: Escape), `escape`, `submit`; queries `value`, `isClearable`; trait
  `field-associated`.
- **Deliberately different**: Enter never prevents native submission (RA does when
  `onSubmit` is set); the native cancel button is hidden only while our ClearTrigger exists.

## Open questions

- Announce "Search cleared" after Escape/Clear? Not by default; measure with the manual
  protocol.
