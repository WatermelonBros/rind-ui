# Suggestions — research

Status: done · Wave: AI

Suggestions are the chips an AI chat shows to save typing: starter prompts on an empty thread
("What can you help with?") and follow-ups after an answer. Pressing one either **sends** it or
**inserts** it into the prompt, and the set usually disappears or is replaced a moment later.
None of the nine headless libraries ships it. The AI kits do, and all of them reduce it to a row
of styled buttons. The behaviour that is left is small but real: what the press hands back, what
happens to focus when the pressed chip leaves the DOM, when the chips must be disabled, and what
assistive technology hears when a new set arrives. There is no model inside: the consumer (or the
AI SDK) produces the strings. This note records how the kits built it, the bugs on their
trackers, and the decisions for `add-suggestions`.

Builds on [prompt-input.md](prompt-input.md) (the send/insert target and its `status`),
[message-thread.md](message-thread.md) (where the chips sit; the thread is not a live region),
[streaming-message.md](streaming-message.md), [button.md](button.md) (`button-like-element`),
and the cross-cutting notes [accessibility.md](accessibility.md) §7 (live regions) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes A, D, H.

Sources read (GitHub API and `gh`, 2026-10-26):

| Library | Files |
|---|---|
| Vercel AI Elements | `vercel/ai-elements` `packages/elements/src/suggestion.tsx` (57 lines) |
| assistant-ui | `packages/react/src/primitives/suggestion/SuggestionTrigger.ts`, file names of `Suggestion{Title,Description}` and `ThreadSuggestions` (listed, not read); issues listed below |
| prompt-kit | `ibelick/prompt-kit` `components/prompt-kit/prompt-suggestion.tsx`; issue #109 |
| Open WebUI | `open-webui/open-webui` issues (search "suggestion", "follow-up") |
| Trackers | `vercel/ai-elements`, `assistant-ui/assistant-ui`, `ibelick/prompt-kit`, `open-webui/open-webui`, `Chainlit/chainlit` (starters; search only) |

Radix, React Aria, Ark/Zag, Base UI, Headless UI, Ariakit, Reka UI, Bits UI and Kobalte ship no
Suggestions. LibreChat's tracker could not be searched through the GitHub API in this session
(search rejected the repository); it is not read here. Chainlit has "starters" (config, not a
component) and no accessibility issue about them was found.

## Pattern

- WAI-ARIA APG: **none**. Each chip is the [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  pattern (accessibility.md §1.5). A set of buttons is a list of independent actions, not a
  composite widget.
- Toolbar? APG: "Use toolbar as a grouping element only if the group contains 3 or more
  controls", with Left/Right Arrow between controls and one Tab stop. Suggestions are usually
  2 to 4, may wrap onto several lines, and are not a tool strip: arrow keys inside a wrapping
  set are ambiguous (left/right across a wrapped line). Plain Tab order is the default; a
  consumer who wants a roving strip puts the chips inside rind-ui's Toolbar (it accepts any
  button-like item).
- Roles and attributes: `role="group"` with an accessible name on the container (the chips
  need a label that says what they are: "Suggested prompts"), native `<button type="button">`
  per chip. No `aria-pressed` (a press is an action), no `role="listbox"`/`option` (nothing is
  selected), no `aria-live` on the container.
- Keyboard: Tab / Shift+Tab, Enter and Space (native button). Nothing else.
- WCAG 4.1.3 Status Messages: a new set of follow-ups appearing after an answer is a status
  change the user did not cause by moving focus. Whether to announce it is a judgement; see
  Accessibility.

## How the others built it

| | AI Elements | assistant-ui | prompt-kit |
|---|---|---|---|
| Parts | `Suggestions` (a `ScrollArea` wrapping a `flex w-max flex-nowrap` row), `Suggestion` | `ThreadPrimitive.Suggestions`, `ThreadPrimitive.Suggestion` / `SuggestionPrimitive.Trigger`, `Title`, `Description` | `PromptSuggestion` only |
| Element | shadcn `Button`, `type="button"` | `Primitive.button` via `createActionButton` | shadcn `Button` |
| What a press hands back | `onClick(suggestion: string)` | no callback: it calls the composer itself (`send`, `clearComposer`) | plain `onClick` |
| Send vs insert | consumer, in `onClick` | `send` prop on the trigger: send, else replace (`clearComposer` default true) or append (`clearComposer={false}`) the composer text | consumer |
| Disabled | button `disabled` | `disabled` from `thread.isDisabled`, queue and voice send mode | button `disabled` |
| Container semantics | none (`div`) | none | none |
| Source of the strings | consumer | consumer, or a `suggestion` adapter that runs after each answer | consumer |

### Vercel AI Elements

- `Suggestion` takes `suggestion: string` and calls `onClick?.(suggestion)`; the label is
  `children || suggestion`. The string is both the label and the payload: a chip cannot show
  "Plan a trip" and send a longer prompt without the consumer keeping a map.
- `Suggestions` sets `whitespace-nowrap`, hides the scrollbar (`<ScrollBar className="hidden">`)
  and scrolls horizontally. The scrollbar is hidden, so no visual cue shows that chips continue past the edge (an
  inference from the source; not tested in a browser).
- No group role, no name, no announcement, no focus handling.

### assistant-ui

- Trigger hook `useSuggestionTrigger({ send, clearComposer })` reads the suggestion's `prompt`
  from state and returns `null` (so the button renders `disabled`) when `disabled`. `send`
  sends the prompt; otherwise it replaces or appends the composer text.
- Append joins with a space only when the draft has text. Fixed in
  [#5935](https://github.com/assistant-ui/assistant-ui/issues/5935): react and vue produced
  `"draft "` for an empty prompt; Svelte already joined non-empty parts.
- A suggestion carries `title`, `description` (a second line) and `prompt`: the label and the
  payload are separate, with an optional secondary text.
- Suggestions come from an adapter that runs **after** a turn
  ([#6708](https://github.com/assistant-ui/assistant-ui/issues/6708): `_suggestions` is reset
  to `[]` at `startRun` and filled only after the roundtrip, so starter chips on an empty
  thread were impossible until static suggestions were added).

### prompt-kit

- `PromptSuggestion` is a button with a `highlight` string: with a highlight it renders as a
  full-width ghost row where the matching substring is styled, which turns the chip into a
  search-result row (autocomplete of prompts). Without it, a pill.
- Open issue [#109](https://github.com/ibelick/prompt-kit/issues/109): the
  `PromptInputAction` example nests a `<button>` in a `<button>` (tooltip trigger around a
  Button); the same wrapping hazard applies to any chip with a tooltip.

### Not shipped

Chainlit configures starters on the server side (`@cl.set_starters`); the UI is not a reusable
component. Open WebUI renders follow-ups as buttons under the reply (see bugs).

## Bug history

Search: the trackers above for "suggestion", "follow-up", "starter", "chip" (open and closed),
about 60 titles listed; the issues cited below were read (#7784 by title only).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| assistant-ui | [#8940](https://github.com/assistant-ui/assistant-ui/issues/8940) | a send-capable suggestion stays enabled while the composer's Send is disabled | the trigger's disabled predicate checks `thread.isDisabled`, queue and voice mode, but not `composer.canSend` | closed | chips share the send gate of the prompt: one `disabled` source, not two predicates |
| assistant-ui | [#5935](https://github.com/assistant-ui/assistant-ui/issues/5935) | append mode adds a stray space for an empty prompt | ``currentText.trim() ? `${currentText} ${prompt}` : prompt`` | closed (join non-empty parts) | the join rule is the consumer's (callback), not ours; do not re-implement text insertion in the component |
| assistant-ui | [#6708](https://github.com/assistant-ui/assistant-ui/issues/6708) | no starter chips on an empty thread | suggestions only produced after a turn | closed | the set is a plain prop; the component does not know when it is "empty" or "follow-up" |
| assistant-ui | [#8830](https://github.com/assistant-ui/assistant-ui/issues/8830) | a stale suggestion result replaces the current one after the adapter changes | a previous generator kept running; no replacement lifecycle | closed | a new set replaces the old one atomically; the consumer owns generation, the component must not cache a previous set |
| assistant-ui | [#7784](https://github.com/assistant-ui/assistant-ui/issues/7784) | chips could not send into a connected voice session | not read beyond the title | closed | (title only) the press is a callback (`onSelect`), not a hard-wired send |
| Open WebUI | [#26257](https://github.com/open-webui/open-webui/issues/26257) | clicking a follow-up saves the completed response without role / parent id / timestamp and breaks the chat on reload | cause not read in depth | closed | the component reports `{ value, index }` and touches no data |
| AI Elements | `suggestion.tsx` (source, no issue) | label and payload are one string; hidden scrollbar on a horizontally scrolling row | design | open (by design) | separate `value` and label; do not hide the only overflow cue without another |
| prompt-kit | [#109](https://github.com/ibelick/prompt-kit/issues/109) | nested `<button>` in `<button>` | tooltip trigger wraps a Button | open | the chip is the only interactive element; a tooltip is attached to it, never around it (HTML validity) |
| assistant-ui | [#8223](https://github.com/assistant-ui/assistant-ui/issues/8223) | a run that starts elsewhere moves focus from another text field into the composer | `focusOnRunStart` fires on every run start | closed | after a press, move focus only if the press itself lost its focus target; never on an external change |

## Accessibility decisions

- **A named group.** The container is `role="group"` with `aria-label` (default message
  "Suggested prompts", overridable). Without a name the chips are anonymous buttons.
- **Each chip is a button named by its text.** A secondary description text is part of the
  name (it is inside the button), not an `aria-describedby` pointing outside.
- **Focus after a press.** The common outcome is that the set is removed (the chip pressed
  was the focus). Focus must not fall to `<body>`: the Root has `tabindex="-1"` as a fallback
  target, and the consumer names where focus belongs after a send (the prompt) through
  `focusTarget`. Rule: focus is moved only when it was inside the Root at the time of the
  press (assistant-ui #8223: never steal focus on an external change).
- **Disabled while busy.** A chip that sends is `aria-disabled` while the prompt cannot send
  (`status` is not idle). `aria-disabled` rather than `disabled` keeps the focused chip
  focused so a keyboard user does not lose their place. A press on an `aria-disabled` chip does nothing and is not announced.
- **A new set is announced once, politely, only when it replaces a set after a user action
  or a finished answer** ("3 suggestions"), not on first mount: a page that loads with
  starter chips must not speak them. The announcement is off by default (`announce: false`)
  because the common case, starters at load, must stay silent; a follow-ups set sets it to
  `"polite"`. Never a live region on the container (the set changes by replacement, and a
  replaced live region re-reads everything).
- **Loading.** While suggestions are being generated the Root has `aria-busy="true"` and
  `data-state="loading"`; placeholders are the consumer's `aria-hidden` skeletons.
- **No hover-only content.** A tooltip on a chip is a Tooltip's job (WCAG 1.4.13); the chip's
  own text is the whole label.
- **Overflow.** A horizontally scrolling set must be reachable by keyboard (Tab scrolls the
  focused chip into view) and not clip focus rings. A wrapping set needs no scrolling; the
  default layout in the theme wraps.

## Testing notes

- Machine in Node: `ready`, `loading`, `disabled`; a press reports `{ value, index }` once;
  a press while disabled reports nothing; replacing the items resets the index space.
- Browser (three engines): Tab order, Enter and Space, focus restored to the target after the
  set unmounts, `aria-disabled` keeps focus, announcement count (recording Announcer) is
  zero on mount and one on a replacement, axe on the group.
- Property: for any sequence of presses and set replacements focus is never on `<body>` if it
  was inside the Root before.

## Decisions for `add-suggestions`

- **Parts**: `Root` (`div role="group"`, named), `Item` (`button type="button"`), `Label`
  (inside an Item: the primary text), `Description` (secondary text, inside the Item, part of
  its name), `Title` is not a separate part (the Label). No Scroll part: scrolling is theme
  and `scroll-area`'s job.
- **Machine** `suggestions`: states `ready | loading | disabled`. Events `PRESS { key }`,
  `ITEMS.CHANGE` (from the collection of Items), `SET_LOADING`. No selection model: nothing
  stays selected. Effects: `focusTarget` on a press when focus was inside; `announce` on a
  replacement.
- **Props**: `disabled`, `loading`, `announce: "off" | "polite"` (default `"off"`),
  `onSelect(details: { value: string; index: number; key: string })`, `focusTarget?: () =>
  Focusable | null` (Interface Segregation: it asks only for `focus()`), `messages`
  (`group`, `count(n)`), `lang`. Item props: `value: string` (the payload, defaults to the
  Label text), `disabled`.
- **Press** is a callback, never a built-in send or insert: the consumer connects it to
  Prompt Input (`setDraft`, `submit`). No `send` / `clearComposer` flags (assistant-ui): those
  fork code paths; the callback composes.
- **`data-*`**: `data-scope="suggestions"`; Root `data-state` (`ready | loading | disabled`),
  `data-count`; Item `data-key`, `data-index`, `data-disabled`, `data-focus`,
  `data-focus-visible`, `data-pressed`, `data-hover`.
- **Contract**: locate by the group's name, else the only Suggestions in the target. Actions
  `pick(textOrIndex)`, `focusItem(index)`. Queries `items` (labels and values), `count`,
  `isLoading`, `isDisabled`, `announcements`, `focusedItem`.
- **Reuse**: Button's press and `button-like-element`; the Announcer; Toolbar when the
  consumer wants roving focus (no code in this component).
- **Non-goals**: generating suggestions; sending; text insertion rules (append / replace);
  the empty-thread vs follow-up distinction (a prop of the consumer's layout); scrolling UI;
  arrow-key navigation (Toolbar).

## Open questions

- **Arrow keys** between chips: Tab is the default; if the tier-1 AT pass shows long sets
  being tedious, a `navigation="roving"` composition with Toolbar is the answer, not a flag
  here.
- **Count announcement wording** for sets that change often (a typing assistant refreshing
  every turn): is "3 suggestions" useful or noise? Manual NVDA and VoiceOver protocol.
- **`aria-disabled` while the prompt streams** versus hiding the set: hiding is the
  consumer's choice; the research found no kit that does either with an announcement.
