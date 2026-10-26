# Mentions / Slash Commands — research

Status: done · Wave: AI

Mentions are an inline combobox inside a text draft. The user types a **trigger character**
(`@` for people, files and context; `/` for commands), a list opens next to the text being
typed, and choosing an item puts a **token** into the draft: a mention of a person or a file,
or a command that runs or stays in the prompt as `/summarize`. It is the Combobox pattern
with three hard additions: the popup is anchored to a **caret** inside a multi-line field (the
libraries read here all measure it with a mirror element), the field is being typed into while the
list is open (IME, mobile keyboards, Backspace and Enter all have two meanings), and the
inserted item is a **range of text that must behave as one unit** (shown as a chip, deleted as
one) while a screen reader still reads a plain draft. There is no model and no data source
inside: the consumer filters or fetches items and receives the chosen items. No headless
library ships it. Editors do (Tiptap, Lexical), and so do the AI kits (assistant-ui; AI Elements
only has an open request). This note records how they built it, the bugs on their trackers,
and the decisions for `add-mentions`.

Builds on [prompt-input.md](prompt-input.md) (the textarea, the IME guard, `INSERT.TEXT` and
`CARET`, "plugins get every key first", and its open question about rich text),
[combobox.md](combobox.md) (`combobox-pattern`: query, results, exposure, staleness,
announcements; its note says Mentions "will reuse `combobox-pattern`"),
[collections.md](collections.md) (active-descendant focus), [floating-positioning.md](floating-positioning.md)
(virtual anchors), [native-platform.md](native-platform.md) §12 (EditContext: avoid; build on
`<textarea>` with a mirror), [tags-input.md](tags-input.md) (tokens as separate chips: the
other design), [streaming-message.md](streaming-message.md) and
[message-thread.md](message-thread.md) (what the sent mentions look like in a thread), and the
cross-cutting notes [accessibility.md](accessibility.md) §4.2, §6, §7, rules 9, 18, 23,
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes B, C, D, J.

Sources read (GitHub API, `gh`, npm tarballs and the W3C pages, 2026-10-26):

| Library | Files |
|---|---|
| Tiptap | `ueberdosis/tiptap` `packages/suggestion/src/{suggestion,findSuggestionMatch,helpers}.ts` and `plugin/{state,view,props}.ts`, `packages/extension-mention/src/mention.ts` (367 lines) |
| Lexical | `facebook/lexical` `packages/lexical-react/src/LexicalTypeaheadMenuPlugin.tsx` (333 lines), `shared/LexicalMenu.tsx` (872 lines) |
| react-mentions | npm tarball `react-mentions@4.4.10` (`dist/react-mentions.cjs.dev.js`, `CHANGELOG.md`, `README.md`); the repository `github.com/signavio/react-mentions` returns 404 on 2026-10-26, so its tracker could not be read |
| assistant-ui | `packages/react/src/primitives/composer/trigger/{TriggerPopover,TriggerPopoverRootContext,TriggerPopoverDirective,triggerKeyboardResource,detectTrigger}.ts(x)`, `composer/ComposerInput.tsx` (501 lines), `packages/core/src/adapters/directive-formatter.ts`; `packages/react-lexical/src/nodes/DirectiveNode.tsx` (grepped for `aria`, `contentEditable`) |
| Ariakit | `examples/combobox-textarea/{index.react.tsx,readme.md}` (a textarea rendered as a Combobox, three trigger characters), `app/src/sandbox/combobox-textarea/utils.ts` |
| `textarea-caret` | `component/textarea-caret-position` README and open tracker (the mirror technique Ariakit uses) |
| AI Elements, prompt-kit, Mantine | `prompt-input.tsx` and the file trees searched for "mention" and "slash": none ship it (AI Elements has issue #179 open) |
| Trackers | `ueberdosis/tiptap`, `facebook/lexical`, `assistant-ui/assistant-ui`, `vercel/ai-elements`, `ariakit/ariakit`, `adobe/react-spectrum` |
| Platform | WAI-ARIA 1.2 `combobox` (read in the W3C text), APG Combobox, UI Events (composition), WCAG 2.2 4.1.3, 2.1.1, 3.3.2 |
| Products | Notion help "Comments, mentions & reactions" (type `@`, the list searches in real time, Enter chooses); Slack behaviour only from third-party guides (typing `@` shows a list, `/` a command list); Slack's own keyboard documentation was not read |

Radix, React Aria, Base UI, Headless UI, Ariakit (a recipe, not a component), Ark/Zag, Reka
UI, Bits UI and Kobalte ship no Mentions. React Aria's `TokenField` is a request, not a
component (see tags-input.md). Mantine has no mention component (no path with "mention" in
its repository tree). "Prism" as named in the brief could not be identified as a library with
a Mention component. React Aria's tracker has no issue about mentions or a textarea combobox
(search "mention", "textarea combobox", "contenteditable", 2026-10-26).

## Pattern

- WAI-ARIA APG **Combobox** (list popup) is the only pattern. DOM focus stays in the text field;
  the highlighted option is `aria-activedescendant`; the popup is a `listbox` of `option`s.
- **The spec does not cover a multi-line combobox.** ARIA 1.2 on `combobox`: "A combobox input
  MAY be either a single-line text field that supports editing and typing or an element that
  only displays the current value". It requires `aria-expanded` on the combobox, `aria-controls`
  referring to the popup, and gives an implicit `aria-haspopup="listbox"`
  ([ARIA 1.2 combobox](https://www.w3.org/TR/wai-aria-1.2/#combobox)). ARIA 1.2 §4.3.2 also names
  "combobox, textbox or searchbox with an `aria-activedescendant` attribute" as the elements an
  active descendant can belong to, so a `textbox` may carry it. Libraries diverge:
  react-mentions sets `role: 'combobox'`, `aria-controls`, `aria-expanded: true`,
  `aria-autocomplete: 'list'`, `aria-haspopup: 'listbox'` and `aria-activedescendant` on the
  textarea **only while the list is open** (`dist/react-mentions.cjs.dev.js`, around line 1240);
  assistant-ui's `ComposerInput` documents that the textarea "receives `aria-controls`,
  `aria-expanded`, `aria-haspopup`, and `aria-activedescendant`" while open and sets no `role`
  (no `role` string in the file); Lexical sets `aria-controls` and `aria-activedescendant` on the
  editor root and `role="listbox"` plus `aria-label="Typeahead menu"` on the popup; Tiptap's
  suggestion utility sets no ARIA at all (grep of `packages/suggestion/src`).
- Keyboard, the common denominator:

| Key | Popup open | Popup closed |
|---|---|---|
| ArrowDown / ArrowUp | highlight next / previous (wraps in assistant-ui) | the field's own (caret moves) |
| Enter | choose the highlighted item (assistant-ui, Lexical `KEY_ENTER_COMMAND`, Notion help) | the host's: newline, or submit in Prompt Input |
| Tab | choose (assistant-ui after #4018, not with Shift; Lexical registers `KEY_TAB_COMMAND`) | focus moves on |
| Escape | close, keep the text | the host's (cancel, close a dialog) |
| Backspace | edits the query; on an empty query in a nested list, goes back (aui `triggerKeyboardResource`) | deletes; next to a mention, replaces it by the trigger (Tiptap) or edits its markup as a unit (react-mentions) |
| ArrowLeft / ArrowRight | Ariakit hides the list (`onKeyDown` in `combobox-textarea`) | caret |
| any key while composing | nothing (accessibility.md rule 18) | nothing |

- WCAG: 2.1.1 Keyboard (every path has a key), 3.3.2 Labels or Instructions (the trigger must
  be discoverable: a visible hint and a described-by text), 4.1.3 Status Messages (result
  count, "no results", the insertion), 2.5.7 does not apply (no drag), 1.4.13 Content on Hover
  or Focus does not apply (the list is not hover-opened).

## How the others built it

| | Tiptap (`suggestion`, `mention`) | Lexical (`TypeaheadMenuPlugin`) | react-mentions | assistant-ui (`TriggerPopover`) | Ariakit (`combobox-textarea`) |
|---|---|---|---|---|---|
| Field | ProseMirror contenteditable | Lexical contenteditable | `<textarea>` over a mirror `div` | `<textarea>` or the Lexical input | `<textarea>` (plain) |
| Token | atom inline node (`atom: true`, `selectable: false`), attrs `id`, `label`, `mentionSuggestionChar` | consumer's node | markup in the value: `@[display](id)`, regex per `Mention` | directive text `:type[label]{name=id}` (`defaultDirectiveFormatter`), a chip node in Lexical (`contentEditable=false`, `aria-label`) | none: the label as plain text |
| Trigger detection | regex on the text before the caret: `allowedPrefixes` (default `[' ']`), `startOfLine`, `allowSpaces`, `allowToIncludeChar` | `triggerFn(text, editor)`; a helper `useBasicTypeaheadTriggerMatch` builds a basic one | `trigger` string or RegExp, `allowSpaceInQuery` | `detectTrigger(text, char, cursor)`: scans back to the nearest whitespace; the char must start the text or follow whitespace; custom `matcher` | `getTrigger`: previous char is a trigger and the one before is whitespace or absent |
| Anchor | decoration node under the query; `getBoundingClientRect()`; Floating UI | a DOM `Range` from the trigger to the caret; `range.getBoundingClientRect()` | a caret `<span>` inside the mirror (`Highlighter`), position from `highlighter.getBoundingClientRect() + caretPosition` | the textarea's mirror | `textarea-caret` at the trigger offset, minus `scrollTop` / `scrollLeft` |
| Popup | consumer's `render()` (`onStart`, `onUpdate`, `onKeyDown`, `onExit`) | `LexicalMenu` portal, `role="listbox"` | `SuggestionsOverlay`, `role="listbox"`, options `role="option"` + `aria-selected` | `role="listbox"` + `aria-activedescendant`, `aria-label` default "Suggestions" | `ComboboxPopover`, `getAnchorRect` |
| IME | keeps matching while `view.composing` (comment cites tiptap#1449) | does not close while `editor.isComposing()`; `closeUnlessComposing` | module-level `isComposing`; `4.4.10`: "Fix suggestions not showing while composing" | `ComposerInput` suppresses text and cursor broadcasts during composition (`compositionRef`) | none |
| Dismiss | `Escape` dispatches an exit and remembers `dismissedRange`, mapped through edits; `shouldResetDismissed` | Escape closes | Escape closes | `Escape` closes; `detectTrigger` returns `null` when the caret is at or before the trigger because "Escape moves the caret to `offset` so a match there would reopen the popover" | ArrowLeft / Right and pointer down hide it |
| Delete | `Backspace` shortcut: replaces the mention by the trigger char (`deleteTriggerWithBackspace: false`) or by nothing | node removal of Lexical | `applyChangeToValue` recomputes the markup from the plain-text change, with a branch for Backspace next to a mention | the chip node's | n/a |
| Insert | `command` callback receiving the editor and the range | `onSelectOption` (receives a close callback and the matching string), `shouldSplitNodeWithQuery` | `onAdd(id, display, start, end)`, `appendSpaceOnAdd` (default false) | `Directive` (insert a chip) or `Action` (run, no text) per trigger; `Categories` and `Back` for two-level lists | `replaceValue`, then `setSelectionRange` after the space |

### Tiptap: the suggestion utility

- A ProseMirror plugin with a state of `{ active, range, query, text, composing,
  dismissedRange, decorationId }`. On every transaction it re-matches against the text node
  before the caret (`findSuggestionMatch`): a regex built from the trigger, a "lookbehind" done
  by hand (`matchPrefix` tested against `allowedPrefixes`), and the match is accepted only if
  `from < $position.pos && to >= $position.pos`.
- `view.composing` is a first-class input: the plugin keeps suggesting "if there is no
  selection, or a composition is active" (`plugin/state.ts`, comment cites tiptap#1449).
- The query is exposed to a `render()` object (`onStart`, `onUpdate`, `onKeyDown`, `onExit`),
  so Tiptap owns detection and the consumer owns the popup, ARIA and keys. That is why the
  tracker is full of "keys still reach a hidden menu" (below).
- The Mention node is `atom: true`, `selectable: false`, `renderText` gives `@label`, and
  it serialises to `data-id` / `data-label` / `data-mention-suggestion-char`. Backspace is
  re-bound so that the mention becomes the trigger character again (reopening the list), unless
  `deleteTriggerWithBackspace`.

### Lexical: typeahead plugin

- `LexicalTypeaheadMenuPlugin` reads the text up to the anchor on every editor update, runs
  `triggerFn`, builds a DOM `Range` from the match start to the caret and passes
  `() => range.getBoundingClientRect()` to the menu.
  The anchor is therefore the trigger-to-caret span, not the caret.
- The menu sets `aria-activedescendant` on the **editor root** each time the index changes and
  `aria-controls` while mounted, and removes both on close (`LexicalMenu.tsx`). It handles
  `KEY_ARROW_DOWN/UP/ESCAPE/TAB/ENTER_COMMAND` at editor priority.
- Closing is guarded: `closeUnlessComposing`. Read-only editors close it (lexical#7160).

### react-mentions (4.4.10)

- A `<textarea>` stacked over a `Highlighter` `div` with identical text metrics. Mentions are
  stored **in the value** as markup, `@[display](id)`; the textarea shows the display text; a map
  between plain-text offsets and markup offsets (`mapPlainTextIndex`, `iterateMentionsMarkup`)
  converts every change; `applyChangeToValue` rebuilds the markup from each plain-text change.
- The caret position is a `<span>` inside the mirror; the suggestions overlay is positioned from
  it, can be portalled (`suggestionsPortalHost`, then `position: fixed` with scroll corrections),
  flipped above (`allowSuggestionsAboveCursor`) and clamped to the viewport.
- Changelog highlights (4.4.x): suggestions not showing while composing, the container not
  aligned with the caret, the cursor jumping to the end on paste with React 18, a double-paste
  bug, native undo/redo when the field was not focused.

### assistant-ui (Unstable_TriggerPopover)

- Per trigger `char`, an `adapter` (categories and items), one **behaviour**: `Directive`
  (insert `:type[label]{name=id}`; `defaultDirectiveFormatter` switches to a quoted form
  when the label contains `]` or the id contains `}`) or `Action` (run a command, no text
  left). `ComposerInput` merges the open popover's `aria-*` into the textarea and gives
  registered plugins the keys before it cancels on Escape. Enter and Tab (without Shift) both
  choose; Escape closes; Backspace with an empty query in a category goes back.
- Item ids are `${popoverId}-option-${id}`; the popover is a `role="listbox"` with
  `aria-label` defaulting to "Suggestions".

### Ariakit: a recipe, not a component

- `Combobox` rendered as a `textarea` (`render={<textarea />}`), `value` is the whole draft,
  `setValueOnChange={false}` and `combobox.setInputValue(searchValue)` give the query only;
  `autoSelect` highlights the first item; `showOnChange/Click/KeyPress` are off and the example
  opens and closes the popover itself; `getAnchorRect` uses `textarea-caret` at the trigger
  offset; `combobox.render()` re-measures on every value change and on `scroll`.
- The inserted text is the plain label plus a space; the caret is put back with
  `setSelectionRange` in a layout effect.

### The mirror technique (`textarea-caret`)

- A hidden `div` styled like the textarea gets the text up to the caret and a `span`; the span's
  offset is the caret position. Its open tracker is the list of what goes wrong: position shifted
  with `word-break: break-word` (#59), wrong when the text is longer than the box (#51),
  Safari and Chrome differ (#53), bad at the end of a line before a wrapped word in Firefox
  (#24), "bad positioning on android" (#16, closed), `border-box` y-coordinate (#49, closed).

### Others

- Notion's help page: type `@` and a name, a pop-up "will search for them in real time", Enter
  chooses; the same menu links pages and dates. Slack: `@` and `/` open lists, per third-party
  guides only. Neither product's keyboard or screen-reader behaviour was read from a primary
  source.
- AI Elements `PromptInput` has no mention or slash support ("Command" in its imports is the
  model picker); issue #179 asks for "rich text input with clickable @mentions and /slash
  commands" and lists Lexical, ProseMirror, Tiptap, react-mentions and rich-textarea. prompt-kit
  ships `prompt-input` and suggestions, no triggers.

## Bug history

Search: the trackers above for "mention", "suggestion", "typeahead", "slash", "IME" and
"composition" (open and closed); the issues below were read or, where marked, seen by title
only. The react-mentions tracker could not be read (repository 404).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Tiptap | [#1449](https://github.com/ueberdosis/tiptap/issues/1449) | popup misplaced on Safari with the Chinese IME | not diagnosed in the report; the plugin's own comment cites it for suggesting while "a composition is active" | closed | keep matching and re-anchor during composition; test Safari with an IME |
| Tiptap | [#6800](https://github.com/ueberdosis/tiptap/issues/6800) | the macOS Pinyin input method does not open the popup, other IMEs do | not diagnosed in the report | open | the open path has an IME test per input method class; never gate opening on a key event |
| Tiptap | [#4947](https://github.com/ueberdosis/tiptap/issues/4947), [#5183](https://github.com/ueberdosis/tiptap/issues/5183), [#3996](https://github.com/ueberdosis/tiptap/issues/3996) (title only) | on Android only the first mention works, the keyboard flashes after removal, Backspace fails 90% of the time on Firefox Android, the Backspace "highlights" the space after a mention | not diagnosed in the reports | open | do not depend on `keydown` for deletion (Android sends keyCode 229): reconcile from the input diff |
| Tiptap | [#5662](https://github.com/ueberdosis/tiptap/issues/5662) | Escape hides the menu, but Enter and arrows still go to the hidden menu | "closed" meant "invisible" after PR #5544 | open | dismissed is state: keys fall through when not open |
| Tiptap | [#7371](https://github.com/ueberdosis/tiptap/issues/7371) | after Escape, ArrowUp then ArrowDown reopens the suggestion | the caret returns inside the old match | open | remember the dismissed range, mapped through edits; reopen only when the query changes or a new trigger is typed |
| Tiptap | [#4183](https://github.com/ueberdosis/tiptap/issues/4183) | in a collaborative editor the list opens for a user who did not type the trigger | opening follows document state, not the local user's input | open | open only from the field's own input events |
| Tiptap | [#4845](https://github.com/ueberdosis/tiptap/issues/4845) | copy and paste of a mention gives plain text | node round trip lost | open | decide copy and paste on purpose: plain text with the label is the textarea model; say so |
| Tiptap | [#6935](https://github.com/ueberdosis/tiptap/issues/6935), [#3320](https://github.com/ueberdosis/tiptap/issues/3320), [#4345](https://github.com/ueberdosis/tiptap/issues/4345), [#3990](https://github.com/ueberdosis/tiptap/issues/3990) (titles only) | cursor jumps after deleting a mention; cannot place the caret before a leading mention in Firefox; Safari selects the whole line before a mention; arrows skip | not diagnosed (titles only); all are `contenteditable` plus inline-node issues | open | the cost of chips in `contenteditable`; the textarea model has no inline nodes to place a caret around |
| Lexical | [#7985](https://github.com/facebook/lexical/issues/7985) | typing Korean fast makes the menu close and open (a "No results" flicker) | the menu closed on composing updates | closed (`closeUnlessComposing`) | exposure must not follow composition churn; empty and results states change only after the query settles |
| Lexical | [#6296](https://github.com/facebook/lexical/issues/6296) | typing Chinese after a mention breaks the entity and repeats characters | not diagnosed in the report | closed | an edit adjacent to a token is outside it, not inside; composition at its end starts plain text |
| Lexical | [#2354](https://github.com/facebook/lexical/issues/2354), [#3834](https://github.com/facebook/lexical/issues/3834) | the list renders over the text on iOS Safari; off-screen near the edges | positioning | closed | flip and shift, and a test on a narrow viewport (floating-positioning.md) |
| Lexical | [#7459](https://github.com/facebook/lexical/issues/7459), [#6277](https://github.com/facebook/lexical/issues/6277), [#4155](https://github.com/facebook/lexical/issues/4155) (titles only) | wrong position when scrolled; hides in a scrollable container; breaks after a window resize | anchor not tracked | closed / open | track scroll of every scroll parent and the field's own, resize and layout shift |
| Lexical | [#7668](https://github.com/facebook/lexical/issues/7668), [#2755](https://github.com/facebook/lexical/issues/2755) (titles only) | dangling menu `div`s prevent clicks; the anchor element is never cleaned up | imperative DOM outside the framework | closed | the popup is a part, unmounted with state (presence) |
| Lexical | [#7160](https://github.com/facebook/lexical/issues/7160) | the menu ignores read-only mode | no editable check | closed | `readOnly` and `disabled` close and block opening |
| Lexical | [#5819](https://github.com/facebook/lexical/issues/5819) (title only) | in tables ArrowDown moves the selection and closes the menu | arrow handled by two layers | closed | the open list owns Arrow keys, `preventDefault` |
| assistant-ui | [#4018](https://github.com/assistant-ui/assistant-ui/issues/4018) | Tab does not choose the highlighted item | only Enter bound | closed (Tab added) | Tab accepts while open (Teams documents Enter or Tab for commands) |
| assistant-ui | [#7292](https://github.com/assistant-ui/assistant-ui/issues/7292) | a stale cursor makes mention and slash detection look at the wrong part of the draft | the plugin cached the caret | closed | detect from the live selection of the event, never a cached offset |
| assistant-ui | [#7831](https://github.com/assistant-ui/assistant-ui/issues/7831) | the demo placeholder advertises "@ to mention" but the popover says "No matching items" | the demo's mention items come from model-context tools and none were registered (per the report) | closed | an empty trigger with no source is a dev warning; the hint text and the triggers share one definition |
| assistant-ui | [#9813](https://github.com/assistant-ui/assistant-ui/issues/9813) | labels containing `]` or ids containing `}` corrupt the chip | the serialisation format was ambiguous | closed (quoted form) | the value stays plain text plus ranges; a serialiser is a separate pure function with escaping tests |
| Ariakit | [#6579](https://github.com/ariakit/ariakit/issues/6579) (title only) | Enter during IME composition exits the field and blocks the commit | composing key treated as an action | closed | the guard is machine state (accessibility.md rule 18) |
| Ariakit | [#6682](https://github.com/ariakit/ariakit/issues/6682) (read) | the combobox input did not point at the active element | `aria-activedescendant` missing | closed | the active id is always on the field while a highlight exists |
| AI Elements | [#179](https://github.com/vercel/ai-elements/issues/179) | request for clickable `@` and `/` tokens in the prompt | not shipped | open | the gap this component fills |
| `textarea-caret` | [#59](https://github.com/component/textarea-caret-position/issues/59), [#51](https://github.com/component/textarea-caret-position/issues/51), [#53](https://github.com/component/textarea-caret-position/issues/53), [#24](https://github.com/component/textarea-caret-position/issues/24), [#16](https://github.com/component/textarea-caret-position/issues/16) | wrong caret on `break-word`, long text, Safari/Chrome, Firefox line ends, Android | mirror drift | open / closed | own the mirror module with a browser test per case; copy computed styles, not a list |
| Base UI | [#5122](https://github.com/mui/base-ui/issues/5122) | an inline anchor that spans two lines is positioned to the wrong client rect | one rect per anchor | open | the anchor is a single rect we compute; no multi-rect anchors |
| react-mentions | CHANGELOG 4.4.x (tracker unreadable) | popup not shown while composing; popup not aligned with the caret; cursor jump on paste; double paste; undo/redo | state kept in two layers (textarea and markup) | fixed | each is a test: composing, caret alignment, paste, undo |

## Accessibility decisions

- **Plain text is what assistive technology reads.** The draft is a `<textarea>` whose value
  contains the label (`@Ada Lovelace `). Chips are a decorative mirror (`aria-hidden`), so the
  accessible name, the caret and the selection are the native ones. This is the reason to avoid
  atom nodes in `contenteditable` for the first version (the Tiptap titles above) and the
  `native-platform.md` §12 decision (EditContext avoided). Contrast with assistant-ui's Lexical
  chip: it needs its own `aria-label` and `contentEditable=false`.
- **The field becomes a combobox only while open**, as react-mentions does: `role="combobox"`,
  `aria-expanded="true"`, `aria-controls` the listbox, `aria-autocomplete="list"`,
  `aria-haspopup="listbox"`, `aria-multiline="true"`, `aria-activedescendant` the highlighted
  option; closed, it is the plain textarea again. This is outside the ARIA 1.2 wording
  ("single-line") and is a tier-1 AT question (open questions). The fallback is to keep
  `textbox` and use only `aria-controls` and `aria-activedescendant`, which ARIA 1.2 §4.3.2
  allows on a textbox.
- **Highlight announcements.** VoiceOver ignores `aria-activedescendant` changes
  (assistive-tech-and-a11y-testing.md cause B), so the shared combobox announcements apply
  unchanged: result count (all platforms, keyed, debounced, polite), "No results", highlighted
  option on Apple and WebKit. Nothing here is a component-owned `aria-live` (rule 23).
- **Discoverability.** The triggers are announced where the user is: `Description` text
  "Type @ to mention, / for commands" wired as `aria-describedby` of the textarea (3.3.2), built
  from the trigger definitions so the hint and the behaviour cannot drift (assistant-ui#7831).
- **Insertion and removal are announced**, once, politely, through the Announcer: "Mentioned
  Ada Lovelace" (the chip text is in the draft already, so the announcement says what happened,
  not what the text is) and "Removed mention Ada Lovelace". An executed command announces
  nothing from here: the consumer's result does.
- **Keys.** Enter and Tab choose only while open and highlighted; Enter never submits a Prompt
  Input while open; Shift+Tab is not handled; Escape closes and the draft is untouched, and
  the dismissed range stops the same match from reopening (Tiptap #5662, #7371; assistant-ui's
  `detectTrigger` comment). Arrow Left/Right move the caret and close the list only when the caret
  leaves the match. Home/End are the field's.
- **IME and composition.** The query follows the composition (the candidate text filters the list),
  because closing on composition caused the flicker of Lexical #7985 and the missing popup of
  react-mentions before 4.4.10. While composing, Arrow, Enter, Tab and Escape do nothing to the
  list (rule 18: Enter commits the IME, not the item); the highlight stays. A trigger typed in an
  IME that reports it only at `compositionend` opens at that moment. Safari's late Enter is
  marked composing by `core/dom/keyboard.ts` (prompt-input.md).
- **Mobile.** Touch screen readers send no keys (cause J) and Android keyboards send
  keyCode 229. Everything works by tap: items are pressable (`pointerdown` does not blur the
  field), the popup is in the DOM next to the field (not portalled to the end of the body) so
  swipe navigation reaches it, and deletion is derived from the input diff, never from a
  `keydown`. The list is `max-height` with its own scroll, and flips above when the soft keyboard
  leaves less room below (visual viewport).
- **Caret anchor.** The popup is anchored to the **trigger character**, not to the moving
  caret (Ariakit and the left edge of Lexical's range): the popup does not walk as the query
  grows. Anchor rect = mirror measurement minus `scrollTop` / `scrollLeft`, re-measured on input,
  scroll, resize and layout shift (floating-positioning.md virtual anchors).
- **Read-only, disabled, no items.** Read-only closes and blocks opening (Lexical #7160); an empty
  query on a trigger with items shows them all; a query with no match shows the Empty part and
  keeps the state `open` (combobox decision "open independent of count") while `aria-expanded`
  becomes `false`.
- **Forced colors and motion.** The mirror's background does not exist in forced colors: the chip
  keeps an underline (or border that does not change metrics). The popup has no animated
  height. Reduced motion: presence ends without animation.

## Testing notes

- Pure functions in Node: `matchTrigger(text, caret, triggers)` (prefixes, start of line,
  `allowSpaces`, Unicode whitespace, trigger inside a word, two triggers, query max length),
  `reconcile(prev, next, selectionBefore, mentions)` (insert before, inside, at the edges;
  delete the last or first character; replace a selection spanning two mentions; composition
  results), `serialize` / `parse` with escaping.
- Machine in Node: open from input only (not from a document change by the host), dismissed range
  mapped through edits, keys fall through when closed, composing guard, stale collection ignored
  (`itemsQuery`), async abort, insertion produces one `INSERT.TEXT` edit and one announcement.
- Model-based: every event in every state; invariants "a mention range never overlaps another",
  "ranges stay inside the text", "the highlighted id exists or is empty", "keys while composing
  change nothing".
- Browser (three engines): caret rect against a reference for wrapped lines, scrolled textarea,
  RTL, zoom 200%, `field-sizing: content`; Enter does not submit while open; `Tab` chooses; focus
  stays in the textarea; IME with a real composition driver where available (Chromium CDP
  `Input.imeSetComposition`) and with synthetic `compositionstart` / `compositionupdate` /
  `compositionend` events elsewhere; narrow viewport; axe on open, empty and loading.
- Manual AT: VoiceOver (Safari, iOS), NVDA (Firefox, Chrome), TalkBack: the combobox role on a
  multi-line field, highlight reading, the insertion announcement, double-tap on an option.

## Decisions for `add-mentions`

- **Textarea first, chips in a mirror.** The draft is the consumer's textarea (`Mentions.Textarea`,
  or Prompt Input's through its context); the value is plain text; mentions are a parallel list
  of **ranges** `{ id, trigger, start, end }` (plus the consumer's `data`). A decorative
  `Highlighter` part (`aria-hidden`, `pointer-events: none`, the textarea's metrics) paints the
  ranges. Rich `contenteditable` stays a separate later component (prompt-input.md open question,
  native-platform §12).
- **Parts**: `Root`, `Textarea`, `Highlighter`, `Mention` (a range inside the Highlighter),
  `Description`, `Positioner`, `Popup`, `List` (`listbox`), `Group`, `GroupLabel`, `Item`,
  `ItemText`, `Empty`, `Loading`. Only `Root`, `Textarea`, `Popup` and `Item` are required;
  the others are optional and the textarea can be the consumer's through a `Textarea` render
  prop.
- **Machine** `mentions`, built on `combobox-pattern` (query, results, exposure, staleness,
  announcements) and the collection's active-descendant focus. States: `closed | open`;
  flags in context: `trigger`, `query`, `range` (the match), `dismissedRange`, `composing`,
  `mentions`, `loading`. Not hierarchical.
- **Events**: `INPUT { value, selection, composing, inputType }`, `SELECTION.CHANGE`,
  `COMPOSITION.START` / `.END`, `KEY.DOWN` (Arrow, Enter, Tab, Escape: handled or not),
  `NAVIGATE` / `HIGHLIGHT` (collections), `ITEM.PRESS`, `OUTSIDE_PRESS`, `BLUR`, `COLLECTION.CHANGE`,
  `MENTION.REMOVE { id }`, `OPEN { trigger }`, `CLOSE`, `$sync:value`, `$sync:mentions`.
- **Props**: `value`, `defaultValue`, `onValueChange`, `mentions`, `defaultMentions`,
  `onMentionsChange`, `triggers: readonly Trigger[]` where `Trigger = { char, id, behavior:
  "insert" | "action", startOfInput?, allowSpaces?, maxQueryLength?, minQueryLength?,
  appendSpace? }`, `onQueryChange({ trigger, query, signal })`, `onSelect({ trigger, item })`
  for `action`, `items` (collection), `loading`, `filter` (default the combobox `contains`,
  `null` for the consumer's), `autoHighlight` (default `true`), `selectOnTab` (default `true`),
  `readOnly`, `disabled`, `announce`, `messages`, `lang`, `formatLabel(item, trigger)`.
  Types: a trigger id is a branded string; `onSelect` is typed by the trigger's item type
  through a const generic over `triggers`.
- **Value model and reconciliation (pure, in `core/components/mentions/`)**: every `INPUT`
  carries before and after values and selections; `reconcile` shifts ranges after an edit and
  applies three rules: an edit **before** a range shifts it; an edit **inside** a range
  (not touching an end) **demotes** it to plain text (the chip dissolves, the text stays; safe
  with IME); a deletion that removes the **last** character (Backspace) or **first** character
  (Delete) of a range, or a selection covering it, **removes the whole range and its text** (one
  step). Derived from the diff, so it also holds on Android, paste, cut and drag. Inserting at
  the end edge starts plain text. Two ranges never overlap or touch ranges that were merged by
  paste; a paste of text identical to a mention label is plain text.
- **Insertion**: the replacement of `[range.start, caret)` is `INSERT.TEXT { text, start, end }`
  (the event Prompt Input already has) with the label and a trailing space (`appendSpace`
  default `true`; Ariakit does, react-mentions does not), then the caret after the space. A
  trigger with `behavior: "action"` removes the `/query` and calls `onSelect`. The insertion
  goes through the host so undo works as far as the platform allows (open question).
- **Trigger detection**: pure `matchTrigger`: the trigger char starts the text or follows
  whitespace (`\s` with Unicode whitespace; Tiptap #4688 title: "Whitespace Unicode
  Discrepancy in Suggestion Query"), the query has no whitespace unless `allowSpaces`, the caret
  is inside or at the end of the match. `/` defaults to `startOfInput` (start of the draft or of
  a line, Tiptap `startOfLine`).
- **`data-*`**: `data-scope="mentions"`; Root and Textarea `data-state` (`open | closed`),
  `data-trigger`, `data-composing`, `data-disabled`, `data-readonly`; Popup / Positioner
  `data-state`, `data-side`, `data-trigger`; Item `data-highlighted`, `data-disabled`,
  `data-selected`; Highlighter `aria-hidden`; Mention `data-trigger`, `data-id`, `data-removing`
  (unused by default; for a theme transition).
- **Contract** (`mentionsContract`): locate by the textarea's role (`textbox`, or `combobox`
  while open) and name; actions `type(text)`, `open(trigger)`, `highlight(label)`,
  `choose(label?)`, `pressEscape`, `pressTab`, `backspace`, `delete(label)`, `blur`; queries
  `isOpen`, `trigger`, `query`, `options`, `highlighted`, `mentions`, `value`, `announcements`,
  `anchorRect`, `isComposing`. Env: `setComposing(bool)` for IME in the jsdom adapter. Traits
  `composite-activedescendant`, `layer`, `presence`, `anchored`.
- **Reuse**: `combobox-pattern`, collections (active descendant, typeahead is off), Prompt Input's
  `INSERT.TEXT`, `CARET`, composing state and key order ("plugins first"), `keyboard-interactions`
  IME guard, `dom/position` virtual anchor, `layer` (non-modal, Escape and outside press), the
  Announcer, `autosize-textarea`. New shared module, written once and used by both Prompt Input
  and Mentions: `core/dom/caret-rect.ts` (the textarea mirror).
- **Deliberately different**: ranges plus plain text, not markup in the value (react-mentions)
  and not atom nodes (Tiptap, Lexical); anchor at the trigger, not the caret; `autoHighlight` and
  `selectOnTab` on (Combobox keeps both off) because the draft is being typed and Tab-to-accept
  is the documented convention; dismissed range, not "hidden"; open only from the field's own
  input; deletion from the diff; combobox semantics only while open; one description naming the
  triggers.
- **Non-goals**: rich `contenteditable` chips; data fetching and search (the consumer's
  `onQueryChange`); mention notifications and permissions; user avatars and presence in the list
  (a theme and consumer markup); two-level category drill-down (assistant-ui's `Categories` and
  `Back`; flat groups first); emoji (`:`) and hashtag lists are other `triggers` entries, not
  features; markup serialisation formats (a pure helper `serialize` / `parse` for the
  `:type[label]{id}` form is a recipe); a model call or tool execution for commands.

## Open questions

- **`role="combobox"` on a multi-line textarea.** The ARIA 1.2 text says "single-line"; no AT
  matrix for it was found. Compare, on tier-1 AT: (a) the role switch while open, (b) staying
  `textbox` with `aria-controls` and `aria-activedescendant`, (c) a separate listbox reached by a
  key. A role switch while typing can reset the reading position in some screen readers.
- **Undo.** Setting `value` programmatically clears the browser's undo stack; the host's
  `setRangeText` does not create an undo step; `execCommand("insertText")` does, but is
  deprecated. Whether Prompt Input's `INSERT.TEXT` can keep native undo must be tested in the
  three engines before the spec promises it. react-mentions' changelog lists undo bugs.
- **Pasting a mention.** Copying a chip copies its plain label; pasting inside the same field
  could re-match a known mention by its label, or stay plain (Tiptap #4845 users expect the
  node). Not decided.
- **Wiring to Prompt Input.** Through Prompt Input's context (a `useMentionsHost()` that exposes the
  textarea, the draft and `INSERT.TEXT`) or as a standalone component that composes by props.
  Decided at the spec; this note's parts assume the standalone `Textarea` plus the context for
  Prompt Input.
- **Chip metrics.** A decorated range in the mirror must not change the width of its text (no
  padding, border width, bold, letter spacing); that restricts themes (reasoned from the
  architecture; not found documented by react-mentions). Is `outline` and `box-shadow` enough
  for a chip look?
- **Slash commands that take arguments** (`/image a cat`): the `/word` is a token and the rest is
  the prompt (Claude, ChatGPT style), or the list stays open as a form. Out of v1.
- **Backspace reopening the list** (Tiptap's default turns a deleted mention back into the
  trigger character and reopens it). Atomic removal is the default here; a `reopen` variant
  would be a new event, not a boolean.
- **Multiple triggers open at once** (`@` inside a `/command` argument). Assumed: the last match
  before the caret wins, one popup at a time.
