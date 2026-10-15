# Tags Input — research

Status: done · Wave: 2

A text input that turns what the user types (or pastes) into a list of tags. The value is a
list of strings the user created; suggestions are optional. Tag Group (a standalone list of
removable tags, no text entry) is a separate component and note.

## Pattern

- WAI-ARIA APG pattern: none. The closest compositions are a **textbox** (no suggestions) or
  the [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) pattern (with
  suggestions), plus a group of removable chips. accessibility.md §1.5 lists Tags Input under
  Combobox; §4.2 puts it with the `aria-activedescendant` components (DOM focus stays in the
  input while suggestions are browsed).
- Roles and attributes required:
  - the input: native `<input type="text">` (role `textbox`), or `role="combobox"` with
    `aria-expanded`/`aria-controls`/`aria-activedescendant` when suggestions are attached;
    named by the Label; `aria-describedby` to a node that lists the current tags;
  - the tags: a container with a role that keeps NVDA in focus mode when arrowing (`toolbar`,
    BU#3629), each tag focusable and named by its text, a remove button named "Remove *tag*";
  - the edit input (when a tag is edited in place): a textbox named "Edit *tag*".
- Keyboard interactions required (no APG table; this is the common denominator of Zag, Reka
  and Ariakit, plus the chip rules add-combobox already specifies):

| Key | Where | Action |
|---|---|---|
| Printable / delimiter | input | type; a delimiter (default `,`) at the caret end creates a tag from the text before it |
| Enter | input, draft not empty | create a tag; never submit the form |
| Enter | input, draft empty | default (implicit form submission) |
| Enter | input, suggestion highlighted | choose the suggestion (combobox-pattern) |
| Backspace | input, caret at start | first press highlights the last tag, second removes it (add-combobox chips) |
| ArrowLeft | input, caret at start | focus the last tag (mirrored in RTL) |
| ArrowLeft / ArrowRight | tag | previous / next tag; past the last → input |
| Backspace / Delete | tag | remove; focus next, else previous, else input |
| Enter (or double press) | tag, `editable` | edit the tag in place |
| Enter / Escape / Tab | edit input | commit / cancel / commit and move on |
| Escape | input | close suggestions; else clear an armed highlight |

## How the others built it

Shipping libraries (components.md): Ark (Zag), Reka, React Aria (TokenField, alpha) and
Ariakit (`Tag*` — components.md lists Ariakit under Tag Group, but its `TagList`/`TagInput`
are a tags input). Base UI has no tags input but its `Combobox.Chips` is the same chip
behaviour (and the maintainers point tag-input requests at "Combobox with custom values",
BU#3390). Radix, Headless UI, Kobalte and Bits UI ship none (RX#987, BITS#460 are feature
requests).

### Ark UI / Zag

- Source: `zag/packages/machines/tags-input/src/{tags-input.machine,connect,dom,types,translations}.ts`; Ark `packages/react/src/components/tags-input`.
- API shape: Root, Label, Control, Input, Item, ItemPreview, ItemText, ItemInput,
  ItemDeleteTrigger, ClearTrigger, HiddenInput. Props: `value`/`inputValue` (controllable),
  `delimiter` (string | RegExp, default `,`), `addOnPaste` (false), `editable` (true),
  `validate({ inputValue, value })`, `allowDuplicates` (false), `blurBehavior` (`add` |
  `clear` | keep), `max` (∞) + `allowOverflow`, `sanitizeValue` (trim), `maxLength`, `name`,
  `form`, `translations` (10 strings, incl. `tagSelected`, `tagsPasted`, `inputLabel(count)`).
- State model: `idle`, `focused:input`, `navigating:tag`, `editing:tag`. The tag highlight
  is **virtual**: DOM focus stays in the input (`POINTER_DOWN_TAG` → `focusInput`), the
  highlighted tag gets `data-highlighted`. Delimiters are detected in the `input` handler
  (`value.endsWith(delimiter)`), not on keydown — which is why the comma works with mobile
  keyboards that send `keyCode 229`. `isComposingEvent` guards the keydown.
- Notable: change log (`refs.log`) feeding announcements ("Added tag X", "Tag X deleted. Tag
  Y selected. Press enter to edit…"); edited tag input auto-resizes; `onValueInvalid({
  reason: "invalidTag" | "rangeOverflow" })`; fieldset-disabled and form-reset tracking.
- Problems: tags have no role at all (`div`s), so AT users meet a textbox with an unexplained
  list of text; the live region is **assertive**; the hidden input is one text input with
  `"a, b"` (and was frozen after mount, ZG#3193); paste validates the whole pasted string
  once, then splits; the edit input is focused in a `raf` (iOS will not show the keyboard,
  ARK#1396); many "stuck state" bugs from missing transitions (ZG#1342, ZG#1662, ZG#238).

### Reka UI

- Source: `reka-ui/packages/core/src/TagsInput/{TagsInputRoot,TagsInputInput,TagsInputItem,TagsInputItemDelete,TagsInputItemText,TagsInputClear}.vue`.
- API shape: Root (`v-model`, `delimiter` string | RegExp, `addOnPaste`, `addOnBlur`,
  `addOnTab`, `duplicate`, `max`, `convertValue` for object values, `displayValue`), Input,
  Item, ItemText, ItemDelete, Clear. Combined with Combobox for suggestions (two components
  composed, RK#1835).
- State model: no machine; `selectedElement` (virtual highlight, focus stays in the input);
  `isComposing` tracked with `compositionstart/end` and kept true until the tick after
  `compositionend`.
- Notable: Enter on a non-empty draft cancels implicit submission synchronously, an empty
  draft submits (RK#2963 fix); delimiter matched on `InputEvent.data`; blur ignores a
  related target inside the controlled listbox (RK#2259 fix); `VisuallyHiddenInput` with
  array values.
- Problems: item `aria-labelledby` on a generic `div` and `aria-current` as the highlight;
  ItemDelete named only by the tag text ("Apple", not "Remove Apple"); index mismatch when a
  disabled tag is present (RK#2785); iOS predictive-text word not reset after Enter (RK#1869,
  open).

### React Aria (TokenField, alpha)

- Source: `react-aria-components/src/TokenField.tsx`, `react-aria/src/tokenfield/{useTokenField,useToken}.ts`, `react-stately/src/tokenfield/*` (git HEAD `e04377c`), docs `s2-docs/pages/react-aria/TokenField.mdx`.
- API shape: TokenField, TokenInput, Token; value is a `TokenFieldValue` of text and token
  segments; a "tag field" is a `TokenFieldValue` subclass whose `tokenize` turns
  comma/space/newline-separated text into tokens.
- State model: a `contenteditable` (`role="textbox" | "searchbox" | "combobox"`) with
  `contentEditable=false` tokens wrapped in zero-width spaces; every edit goes through
  `beforeinput` and is re-rendered by React. Composition: React rendering is blocked during
  composition and DOM mutations are reverted at `compositionend` ("mutating the DOM in any
  way during composition breaks the IME"); Android's missing `compositionend` handled.
- Notable: announces the token next to the caret (`announce(text, "assertive")`) because a
  screen reader would otherwise read one character; virtual clicks select a token; custom
  clipboard type for copy/paste of tokens.
- Problems: an editor, not a form control — caret measurement and scroll bugs (RA#10669,
  RA#10761 open, RA#10764 open). Rich inline tokens are a different component (Mentions /
  Prompt Input; native-platform §12 keeps `contenteditable` out of core for now). The older
  advice for tags was "TagGroup next to a ComboBox", and putting TagGroup inside ComboBox
  crashed (RA#6814).

### Ariakit

- Source: `ariakit-react-components/src/tag/{tag-input,tag-list,tag,tag-remove,tag-control,utils}.tsx`, `ariakit-components/src/tag/tag-store.ts`.
- API shape: TagProvider (`values`, `value` = draft), TagLabel, TagControl, TagList, Tag,
  TagRemove, TagInput (`delimiter` string | RegExp | array, default `["\n", ";", ",", /\s/]`,
  `addValueOnPaste`, `addValueOnChange`, `removeOnBackspace`, all boolean-or-callback).
- State model: one **Composite** over the tags and the input (roving, real DOM focus on
  tags); TagList is `role="listbox"` (desktop) / `list` (touch) with `aria-live="polite"
  aria-atomic`; tags are `option` / `listitem`. Splitting runs on `change` only at a
  trailing caret, keeping the last segment as the draft; paste splits and adds each value.
  Backspace at the caret start removes the last tag at once (no arm step). Values are
  deduplicated; undo/redo through `UndoManager`.
- Notable: TagRemove is `aria-hidden` on desktop (keyboard users remove with
  Backspace/Delete, the tag is described by "Press Delete or Backspace to remove") and a
  real named button on touch; typing a printable key or ⌘V on a tag moves focus to the input
  so the text lands there.
- Problems: IME preedit split into junk tags by the whitespace delimiter (AK#6294); string
  delimiters compiled as regexes froze the page (AK#6333); standalone TagRemove focusable
  but `aria-hidden` with no name (AK#6330); `display: contents` on the list moved click and
  empty-state semantics around (AK#7155, AK#7160, AK#7164) — and the investigation found that
  **no tested screen reader announced tag removals** from the live listbox (AK#7164).

### Base UI (Combobox chips, for comparison)

- Source: `base-ui/packages/react/src/combobox/{chips,chip,chip-remove}/*`.
- Chips container gets `role="toolbar"` only when chips exist (NVDA browse mode, BU#3629);
  clicking the chips padding focuses the input (BU#4289). Already adopted by add-combobox.

## Accessibility

Applies [accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
(Combobox / listbox / autocomplete section; causes A, B, D, E) and
[native-platform.md](native-platform.md).

- **Roles.** Without suggestions the input stays a native textbox: a `combobox` role with no
  popup is a lie (`aria-expanded` meaningless). With suggestions it becomes the
  combobox-pattern input, so cause B (VoiceOver silent on `aria-activedescendant`) is
  handled by the pattern's announcer. The tags are the add-combobox chips: `role="toolbar"`
  container (keeps NVDA in focus mode, BU#3629) labelled by the `chipsLabel` message, each
  chip focusable (roving) and named by its text, ChipRemove a `tabindex=-1` button named
  `removeLabel(tag)`. Ariakit's `listbox`/`option` reading is not adopted: options inside a
  listbox announce "selected/not selected" semantics a tag does not have, the input cannot be
  a listbox child, and Ariakit itself needed `display: contents` workarounds (AK#7160).
- **Naming and description.** Label → input via `<label for>`. The input's
  `aria-describedby` references a visually hidden node with the tag texts (add-combobox
  chips rule), so a screen reader user landing in the input hears what is already there.
  Zag's `inputLabel(count)` idea becomes part of that node ("3 tags: a, b, c").
- **Announcements** go through the injected Announcer, polite, never an `aria-live` list
  (AK#7164 found removals unspoken; Zag's assertive region interrupts typing). Messages: tag
  added, N tags added (paste), tag removed (owned by the chips), tag updated, entry refused
  (duplicate / invalid / max) — a refused Enter that only flashes a colour is silent for AT
  and fails 1.4.1 / 4.1.3.
- **IME** is a machine guard (accessibility.md §6, keyboard-interactions): no Enter,
  delimiter, Backspace-arm or Arrow transition while composing; Safari's commit-Enter after
  `compositionend` is still composing (quirk entry). Delimiters must not match inside the
  preedit (AK#6294: Pinyin preedit contains spaces).
- **Mobile.** Android soft keyboards send `keyCode 229` for every key, so delimiters are
  detected from the text change (`input` event), never from keydown (ZG#293); iOS only
  shows the keyboard when focus moves inside the user gesture, so the edit input is focused
  synchronously (ARK#1396). Touch SRs cannot send Backspace to a chip, so ChipRemove stays
  in the accessibility tree as a named button (unlike Ariakit's desktop `aria-hidden`).
- **Forced colors / target size.** Chips need a border, not a background, to be visible in
  forced colors; the highlighted chip uses an outline; ChipRemove and Clear ≥ 24×24 CSS px
  via `--rind-hit-area` (accessibility.md §8).
- **RTL.** ArrowLeft/Right between chips mirror (keyboard-interactions); "caret at start"
  means logical start.
- **Native.** No native tags control; `<datalist>` gives suggestions but no tags. The input
  width uses `field-sizing: content` in the theme (native-platform §11), with flex growth as
  the fallback. Form participation uses hidden native inputs (native-platform §14).

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [ZG#804](https://github.com/chakra-ui/zag/issues/804) closed | Enter while composing CJK adds a tag | No IME guard on Enter | Guard added | IME guard on every creating transition |
| Reka | [RK#1441](https://github.com/unovue/reka-ui/issues/1441) closed | Japanese conversion Enter adds a tag | Commit Enter treated as submit | Composition tracking | Commit Enter is composing (Safari quirk) |
| Reka | [RK#2024](https://github.com/unovue/reka-ui/issues/2024) closed | Korean "한글" + Enter → "한글" and "글" | Reported with one IME; maintainers could not reproduce | Closed | Korean composition in the IME replays |
| Ariakit | [AK#6294](https://github.com/ariakit/ariakit/issues/6294) closed | Pinyin preedit split into junk tags, composition destroyed | Delimiter split on `insertCompositionText` changes; `/\s/` matches preedit spaces | Guarded on `isComposing` | Never split while composing |
| Ariakit | [AK#6579](https://github.com/ariakit/ariakit/issues/6579) closed | Enter during composition leaves the field | Container keydown not IME-guarded | Guarded | The guard covers every key handler, incl. containers |
| Zag | [ZG#293](https://github.com/chakra-ui/zag/issues/293) closed | Mobile: Enter and comma close the keyboard, no tag | Keydown-based handling with 229 key codes | Moved to input handling | Delimiters from the text change, not keydown |
| Reka | [RK#1869](https://github.com/unovue/reka-ui/issues/1869) open | iOS predictive word not reset after Return | Programmatic value reset keeps the keyboard's word context | Open | Known iOS limitation; documented, manual check |
| Reka | [RK#2963](https://github.com/unovue/reka-ui/issues/2963) closed | Enter submits the form before the draft becomes a tag | Implicit submission not cancelled synchronously | Cancel when the draft is non-empty | Enter on a draft creates, empty Enter submits |
| Zag | [ZG#1665](https://github.com/chakra-ui/zag/issues/1665) closed | Can paste only once; paste cannot be undone | `preventDefault` on every paste | Handle on change | Only take over a paste that is split into tags |
| Zag | [ZG#1662](https://github.com/chakra-ui/zag/issues/1662) closed | After deleting a pasted tag, paste stops working | State without a PASTE transition | Transition added | Model tests cover paste from every state |
| Zag | [ZG#1342](https://github.com/chakra-ui/zag/issues/1342) closed | After a paste with `addOnPaste` off, no tag can be added | Missing transition | Fixed | Same |
| Zag | [ZG#238](https://github.com/chakra-ui/zag/issues/238) closed | Delete a tag while a draft exists, Enter → input dead | Stuck state | Fixed | Same: graph coverage |
| Zag | [ZG#3051](https://github.com/chakra-ui/zag/issues/3051) closed | Values always trimmed | Hard-coded sanitiser | `sanitizeValue` prop | Normaliser is a prop, trim by default |
| Reka | [RK#2137](https://github.com/unovue/reka-ui/issues/2137) closed | Delimiter-only or whitespace input creates empty tags | Split before normalising | PR #2136 | Empty after normalising → no tag |
| Zag | [ZG#2927](https://github.com/chakra-ui/zag/issues/2927) closed | Duplicates impossible even with `validate` | Internal `uniq` | `allowDuplicates` | Duplicates are a prop; keys stay unique |
| Reka | [RK#1400](https://github.com/unovue/reka-ui/issues/1400) closed | Pasted emails/tabular data need several delimiters | One delimiter | `string \| RegExp` | Delimiter list incl. newline/tab for paste |
| Ariakit | [AK#6333](https://github.com/ariakit/ariakit/issues/6333) closed | `"\|"` freezes, `"+"` throws, `"."` never splits | String delimiters compiled as regexes | Literal matching | Strings are literal, regexes are regexes |
| Reka | [RK#2785](https://github.com/unovue/reka-ui/issues/2785) closed | Backspace removes the disabled tag, not the highlighted one | Index into a filtered list vs. index into the model | Fixed | Remove by key, never by index |
| Zag | [ZG#1911](https://github.com/chakra-ui/zag/issues/1911) closed | Delete on a tag breaks arrow navigation | Highlight not repaired after removal | Fixed | Removal repairs focus (chips rule) |
| Zag | [ZG#2328](https://github.com/chakra-ui/zag/issues/2328) closed | Click in the input keeps the armed tag; next Backspace removes it and a character | Highlight not cleared on caret moves | Fixed | Any caret move/press in the input disarms |
| Ark | [ARK#3602](https://github.com/chakra-ui/ark/issues/3602) closed | Tab out leaves the tag highlighted | Blur not handled in the tag state | Fixed in Zag | Leaving the component clears highlight |
| Reka | [RK#1914](https://github.com/unovue/reka-ui/issues/1914) closed | Click away keeps the active tag | Same | Fixed | Same |
| Zag | [ZG#3193](https://github.com/chakra-ui/zag/issues/3193) closed | Native submit sends the mount-time value | Hidden input `defaultValue` never updated | Fixed | `hidden-form-input` mirrors after every commit |
| Zag | [ZG#2376](https://github.com/chakra-ui/zag/issues/2376) closed | Hidden input broken in Svelte | Adapter-specific value writing | Fixed | Carriers rendered by connect, same in every adapter |
| Ark | [ARK#2003](https://github.com/chakra-ui/ark/issues/2003) closed | Edited tag cannot be committed; no new tags after editing | ItemInput placement inside Item broke events | Fixed next major | Editing owned by the machine, independent of DOM nesting |
| Ark | [ARK#1396](https://github.com/chakra-ui/ark/issues/1396) closed | iOS: no keyboard when editing a tag | Edit input focused in `raf`, outside the gesture | "iOS issue", not fixed | Focus the edit input synchronously in the press |
| Zag | [ZG#1661](https://github.com/chakra-ui/zag/issues/1661) closed | Combobox + tags: pasted value added twice | Two machines both commit | Fixed | One machine owns commits |
| Ark | [ARK#2742](https://github.com/chakra-ui/ark/issues/2742) closed | Combobox + tags: removed tags come back | Two values out of sync | Usage fix (control both) | Suggestions inside the tags machine |
| Reka | [RK#2259](https://github.com/unovue/reka-ui/issues/2259) closed | Combobox tags + addOnBlur: click on "Apple" adds "a" | Blur fires before the option press | Related-target check | Option presses keep focus; blur inside is not blur |
| Reka | [RK#1579](https://github.com/unovue/reka-ui/issues/1579) closed | Delete buttons dead inside a Combobox | Combobox swallowed the press | Fixed | Chip presses count as inside |
| React Aria | [RA#6814](https://github.com/adobe/react-spectrum/issues/6814) closed | TagGroup inside ComboBox crashes | Shared list-state context | "Not intended", compose outside | No nesting of two collection components |
| Base UI | [BU#3629](https://github.com/mui/base-ui/issues/3629) closed | NVDA: arrows between input and chips do nothing | Browse mode without a container role | `role="toolbar"` | Inherited from add-combobox chips |
| Base UI | [BU#5547](https://github.com/mui/base-ui/issues/5547) open | ArrowLeft onto a chip closes the popup and drops the query | Chips not inside | Draft PR | Inherited: chips are inside |
| Base UI | [BU#4289](https://github.com/mui/base-ui/issues/4289) closed | Click in the chips padding does not focus the input | No handler on the container | Handler on Chips | Control press focuses the input |
| Ariakit | [AK#7155](https://github.com/ariakit/ariakit/issues/7155) closed | Clicking the tag field no longer focuses the input | Handler on a `display: contents` element | Moved to the control | Same; handler on the Control |
| Ariakit | [AK#6330](https://github.com/ariakit/ariakit/issues/6330) closed | Focusable `aria-hidden` remove button without a name | Hidden on desktop by default | Fixed | ChipRemove is a named button, `tabindex=-1`, never `aria-hidden` |
| Ariakit | [AK#7164](https://github.com/ariakit/ariakit/issues/7164) closed | Tag removal not announced by any tested SR | `aria-live` listbox removals are not spoken | Documented | Announcer messages, not a live list |
| Reka | [RK#1718](https://github.com/unovue/reka-ui/issues/1718) closed | `autocorrect="off"` became `on` | Framework attribute coercion (Vue) | Vue 3.5.14 | Attribute values are strings through `normalizeProps` |
| React Aria | [RA#10669](https://github.com/adobe/react-spectrum/issues/10669) closed | Enter/Backspace scroll the page up | contenteditable caret measuring | PR #10676 | Native `<input>`, no caret measuring |

## Known pitfalls

- **IME** (four libraries): Enter, delimiters and Backspace during composition; Safari's
  commit Enter after `compositionend`; whitespace delimiters inside preedit.
- **Mobile keyboards**: keyCode 229, `enterkeyhint`, iOS focus-in-gesture, iOS predictive
  text context.
- **Two components composed** (Tags Input + Combobox) double-commit or desync in Zag/Ark,
  Reka and React Aria — the suggestions belong to the same machine.
- **Stuck states** from missing transitions (Zag, five issues) — the statically declared
  machine plus model-based paths over paste/delete/edit catch them.
- **Index-based removal** with disabled tags or duplicates (RK#2785).
- **Highlight left armed** after clicks, Tab, outside presses (ZG#2328, ARK#3602, RK#1914).
- **Paste** taken over too eagerly (undo, repeat paste) or validated as one string.
- **Form value** frozen or joined into one string; draft text submitted under the tags' name.

## Testing notes

- Composition: the contract's `compose(text, commit)` (combobox-pattern) replays IME
  sequences; add a Pinyin preedit with spaces and a Korean syllable sequence.
- Paste: the environment needs a `paste(text)` input that dispatches `paste` with
  `clipboardData` and, when not taken over, `insertFromPaste` input — jsdom lacks
  `ClipboardEvent`; `@rind-ui/testing/setup` polyfills it.
- Mobile delimiter: a test types "," as an `input` event with `keyCode 229` keydown.
- Driver: actions `type`, `addTag(text)`, `paste(text)`, `removeTag(name)`, `editTag(name,
  text)`, `clear()`, `compose`; queries `tags()`, `inputValue()`, `announcements()`,
  `isAtMax()`.
- Form: native submit, reset, `required` with zero tags, through Field validation.

## Decisions

- **One machine, `tags-input`**, with chips from the shared add-combobox chip pieces and,
  when a `collection` is given, suggestions from `combobox-pattern` spread into the same
  machine (one owner of every commit). Not a Combobox preset: the value is free text, there
  may be no popup, and editing/paste/delimiters are states the Combobox does not have.
- **Parts**: Root, Label, Control, Chips, Chip, ChipText, ChipRemove, ChipInput (edit),
  Input, ClearTrigger; with suggestions: Positioner, Popup, List, Item, ItemText, Group,
  GroupLabel, Separator, Empty. Hidden carriers rendered by Root.
- **Machine states**: `idle` (focus outside), `typing` (input focused or chips focused),
  `editing` (a chip's edit input focused), `suggesting` (popup open; only with a
  collection). Events below in the design.
- **Defaults**: `delimiter: ","` (strings literal, RegExp allowed, list allowed), Enter
  always creates; `addOnPaste: true` with paste delimiters `[",", "\n", "\t", ";"]` (only
  takes over a paste that contains one); `normalize: trim`; `allowDuplicates: false`
  (duplicates refused, case-sensitive by default, `compare` prop); `max: Infinity`
  (refused at max, no overflow mode); `blurBehavior: "keep"` (`"add"`, `"clear"`);
  `editable: true`; `removeOnBackspace: true` (arm then remove, from the chips).
- **Keys**: tag keys are the value when duplicates are off, else value + occurrence
  ordinal — removal, edit and focus repair go by key.
- **Validation**: `validate(text, value) => true | string` (a string is the refusal reason
  shown/announced); refusal reasons `empty | duplicate | invalid | max`; the draft stays in
  the input, `data-refused` on the input until the next change, `onRefuse({ reason, text })`,
  polite announcement. Field validity (required / min count) is separate.
- **Paste**: split, normalise, validate each segment; accepted ones become tags in order;
  refused segments stay in the input, joined by the first string delimiter; one "N tags
  added" announcement.
- **Editing**: Enter or double press on a chip; the edit input replaces the chip text,
  focused synchronously; Enter or blur commits (empty commit removes), Escape cancels; focus
  returns to the chip.
- **Form**: `hidden-form-input` list carriers (one `<input type="hidden" name>` per tag) and
  the validity proxy for `required`; the visible input has no `name` (draft not submitted)
  unless `inputName`.
- **`data-*`**: Root/Control `data-focus`, `data-disabled`, `data-readonly`,
  `data-invalid`, `data-empty-value`, `data-at-max`; Input `data-refused`; Chip
  `data-highlighted`, `data-editing`, `data-disabled`, `data-focus-visible`; plus chips and
  pattern attributes.
- **Contract**: as in Testing notes, plus the chips and (with suggestions) the pattern
  contract; traits `form-associated`, `field-associated`, `composite-roving` (chips),
  conditional pattern traits.
- **Deliberately different**: real focus on chips (Ariakit, add-combobox) instead of Zag/Reka
  virtual highlight; polite announcer instead of an assertive region or a live listbox;
  per-segment paste validation; refused input is announced; per-tag hidden carriers instead
  of a comma-joined string; no `contenteditable` (React Aria's TokenField is the Mentions /
  Prompt Input direction).

## Open questions

- iOS predictive-text context after a programmatic reset (RK#1869): is a
  `setRangeText`-based clear enough, or is it unfixable? Needs a device test; not spec-level.
- Undo/redo of tag creation and removal (Ariakit `UndoManager`): deferred.
- Should `addOnPaste`'s default paste delimiters include whitespace for email lists? Kept out
  (multi-word tags); consumers pass `pasteDelimiter`.
