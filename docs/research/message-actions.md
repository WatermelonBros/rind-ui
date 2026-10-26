# Message Actions — research

Status: done · Wave: AI

Message Actions are the small controls under (or beside) one chat message: **copy** it,
**regenerate** an answer, **edit** a user message, rate it with **thumbs up / down**, and step
through the **versions** of a message ("2 / 3") when it was edited or regenerated. They look
like a row of icon buttons and are mostly that, but a transcript has hundreds of them, they
appear and disappear on hover, they act on content that streams, and the controlled message is
often replaced the moment an action runs. That is where the bugs and the accessibility work
are. There is no model inside: the consumer decides what regenerate, edit and feedback do and
which versions exist; the component owns the row's semantics, the per-action status, the
focus rules and the announcements. None of the nine headless libraries ships it. The AI kits
all do. This note records how they built it, the bugs on their trackers, and the decisions for
`add-message-actions`.

Builds on [toolbar.md](toolbar.md) (roving focus, `focusableWhenDisabled`, composite host),
[toggle-group.md](toggle-group.md) and [toggle.md](toggle.md) (`aria-pressed`),
[clipboard.md](clipboard.md) (the copy state machine and result announcement),
[button.md](button.md), [message-thread.md](message-thread.md) (messages are articles in a
feed; "Messages contain their own controls (copy, regenerate), which take Tab as usual"),
[streaming-message.md](streaming-message.md) (what regenerate restarts),
[prompt-input.md](prompt-input.md) (edit reuses a composer), and the cross-cutting notes
[accessibility.md](accessibility.md) §1.5 and §7,
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes A, D, H.

Sources read (GitHub API and `gh`, 2026-10-26):

| Library | Files |
|---|---|
| Vercel AI Elements | `vercel/ai-elements` `packages/elements/src/message.tsx` (360 lines: `Message`, `MessageContent`, `MessageActions`, `MessageAction`, `MessageBranch`, `MessageBranchContent`, `MessageBranchSelector`, `MessageBranchPrevious`, `MessageBranchNext`, `MessageBranchPage`, `MessageResponse`) |
| assistant-ui | `packages/react/src/primitives/actionBar/{ActionBarRoot,ActionBarCopy,ActionBarFeedbackPositive,useActionBarFloatStatus}.ts(x)`, file names of the other action bar primitives (`Edit`, `Reload`, `Speak`, `StopSpeaking`, `ExportMarkdown`, `FeedbackNegative`, `ActionBarInteractionContext`), `primitives/branchPicker/{BranchPickerRoot,BranchPickerNext,BranchPickerCount}`, file names of `BranchPickerNumber` and `Previous` |
| prompt-kit | `components/prompt-kit/message.tsx` (grep: `MessageActions`, `MessageAction` with a Tooltip) |
| Open WebUI | issues only (response action buttons) |
| Trackers | `vercel/ai-elements`, `assistant-ui/assistant-ui`, `ibelick/prompt-kit`, `open-webui/open-webui` |
| Platform | WAI-ARIA APG Toolbar and Button patterns |

Radix, React Aria, Ark/Zag, Base UI, Headless UI, Ariakit, Reka UI, Bits UI and Kobalte ship no
Message Actions. LibreChat's tracker could not be searched through the GitHub API in this
session (search rejected the repository) and is not read. CopilotKit and Chainlit have
feedback hooks but no action-bar component in what was read; no bug about them was found.

## Pattern

- WAI-ARIA APG **Toolbar**: "Use toolbar as a grouping element only if the group contains 3 or
  more controls." One Tab stop for the whole group; Left / Right Arrow (horizontal) between
  controls; Home / End optional; the toolbar has `aria-label` or `aria-labelledby`. A message
  action row is exactly that when it has three or more actions (copy, regenerate, a thumb
  pair, the branch buttons), and a long transcript is the reason to prefer it: one stop per
  message instead of five or six.
- **Button** for copy, regenerate, edit, previous and next version. A pure action: no
  `aria-pressed`.
- **Toggle button** (`aria-pressed`) for thumbs up and down: a state the user set, which AT
  must hear (assistant-ui #7723). The two thumbs are mutually exclusive: a Toggle Group in
  single mode (toggle-group.md).
- **Status** for the version counter: APG has no pattern; the text "2 / 3" is read as part of
  the group, the change is announced by a polite status message (WCAG 4.1.3) because focus
  stays on the pressed button while the message content swaps.
- WCAG 2.5.8 target size 24 px; 1.4.13 content on hover or focus: an action row shown only on
  hover must also show on focus and be reachable by touch.

## How the others built it

| | AI Elements | assistant-ui | prompt-kit |
|---|---|---|---|
| Row | `MessageActions`: `div.flex.gap-1`, no role | `ActionBarPrimitive.Root`: `div`, no role; auto-hide and float logic | `MessageActions`: `div` |
| Action | `MessageAction`: ghost `Button` + `<span class="sr-only">{label \|\| tooltip}</span>`, wrapped in a Tooltip when `tooltip` is set | `Copy`, `Edit`, `Reload`, `Speak`, `StopSpeaking`, `ExportMarkdown`, `FeedbackPositive`, `FeedbackNegative`: each `Primitive.button` with an `onClick` callback and `disabled` when unavailable | `MessageAction`: Tooltip around a child |
| Copy state | consumer | built in: `copiedDuration` (default 3000 ms), `data-copied`, message `isCopied` | consumer |
| Feedback | consumer | `aria-pressed` and `data-submitted` from `message.metadata.submittedFeedback` | consumer |
| Visibility | consumer CSS | `autohide: "always" \| "not-last" \| "never"`, `autohideFloat`, `hideWhenRunning`; hidden means **not rendered** (`return null`) | consumer |
| Branch picker | `MessageBranch` with `Previous`, `Next`, `Page` ("{n} of {total}") | `BranchPickerPrimitive.Root`, `Previous`, `Next`, `Number`, `Count`; `hideWhenSingleBranch` | none |

### Vercel AI Elements

- **Actions**: icon buttons carry a screen-reader-only text from `label || tooltip`; if
  neither is given the button has no name (the API does not require one). The Tooltip wraps
  each action in its own `TooltipProvider`.
- **Branches**: `MessageBranch` holds `currentBranch` in `useState` and registers its children
  (`MessageBranchContent`) with an effect (`setBranches`) when the count changes. Inactive
  branches stay mounted and get the `hidden` class. `goToNext` and `goToPrevious` **wrap
  around** (last to first). The buttons have static `aria-label` "Previous branch" / "Next
  branch" and are `disabled` when there is one branch or fewer; the selector renders nothing
  for `totalBranches <= 1`; the counter is the text `{currentBranch + 1} of {totalBranches}`
  with no live region or label. `onBranchChange(index)` is the only callback.
- No role on the row, no Tab economy, no focus handling when a branch changes, no
  announcement.

### assistant-ui (`ActionBarPrimitive`, `BranchPickerPrimitive`)

- `Root` (`useActionBarFloatStatus`) returns one of `Hidden`, `Floating`, `Normal` from the
  thread's running state, whether this is the last message, and `message.isHovering`; when
  `Hidden` it **returns `null`**, so the buttons leave the DOM. An
  `ActionBarInteractionContext` with `acquireInteractionLock()` lets a child (a "More" menu)
  hold the bar visible while it is open, counted so that nested locks release in any order.
- `Copy` calls `navigator.clipboard.writeText` and rejects when the API is absent; the
  copied flag is a message property with a timer (see bugs #7867, #7937, #7950).
- Feedback buttons set `aria-pressed={isSubmitted}` and `data-submitted` after
  [#7723](https://github.com/assistant-ui/assistant-ui/issues/7723).
- `BranchPicker.Root` takes `hideWhenSingleBranch`; `Next` is a button whose hook returns `null`
  (so it renders `disabled`) when the core says it is disabled (whether that means the last
  branch was not read); `Count` renders the bare number; the
  documented usage is "Branch `<Number />` of `<Count />`" assembled by the consumer.

### prompt-kit

- `MessageActions` / `MessageAction` are thin: a `div` and a Tooltip around the consumer's
  button. Nothing about state.

### Open WebUI (observed through issues)

- Action buttons under a reply (#32854 names Copy, Read Aloud and an info button; the issue
  titles also name copy, export, merge and artifact buttons) are icon buttons; several had no
  accessible name ([#32610](https://github.com/open-webui/open-webui/issues/32610)),
  the copy confirmation was an icon change only
  ([#32904](https://github.com/open-webui/open-webui/issues/32904)), toasts were not announced
  ([#32633](https://github.com/open-webui/open-webui/issues/32633)), and a button visible only
  on hover was invisible when focused
  ([#32603](https://github.com/open-webui/open-webui/issues/32603), a model selector's "..."
  button, the same hover-only pattern).

## Bug history

Search: the trackers above for "action bar", "message action", "copy", "regenerate",
"branch", "feedback", "edit", "focus" (open and closed), title lists per search, the issues below read (entries marked "title only" were not opened).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| assistant-ui | [#8208](https://github.com/assistant-ui/assistant-ui/issues/8208) | closing the edit composer with Escape or Cancel drops focus to `<body>` | the focused element unmounts, nothing restores focus | closed | focus returns to the Edit button when `editing` ends |
| assistant-ui | [#7723](https://github.com/assistant-ui/assistant-ui/issues/7723) | screen reader cannot tell which of Helpful / Not helpful is active | selected rating only as `data-submitted` | closed (`aria-pressed`) | thumbs are toggle buttons with `aria-pressed` from the machine, not only a data attribute |
| assistant-ui | [#7867](https://github.com/assistant-ui/assistant-ui/issues/7867), [#7937](https://github.com/assistant-ui/assistant-ui/issues/7937), [#7950](https://github.com/assistant-ui/assistant-ui/issues/7950), [#7965](https://github.com/assistant-ui/assistant-ui/issues/7965) | a second copy inside the window loses its confirmation early; the check shows even when `writeText` rejects; the timer survives unmount | a new `setTimeout` per copy never cleared; confirmation set before the write settles | closed | reuse Clipboard's machine: one timer, restarted, decided by the promise, on the injected Scheduler |
| assistant-ui | [#4071](https://github.com/assistant-ui/assistant-ui/issues/4071), [#8391](https://github.com/assistant-ui/assistant-ui/issues/8391) | the branch picker shows "2 / 2" on a new conversation; giving user messages ids adds a 2/2 branch | the runtime produced a phantom sibling | closed | the count is the consumer's; the picker renders only for two or more versions and shows `data-count` |
| assistant-ui | [#9511](https://github.com/assistant-ui/assistant-ui/issues/9511), [#9515](https://github.com/assistant-ui/assistant-ui/issues/9515), [#8156](https://github.com/assistant-ui/assistant-ui/issues/8156) | a deleted message comes back as a sibling branch (host drops it from an array, delete confirmed after switching branch, async `onDelete`); title only | not read; the titles point to branch identity and timing | closed | version identity is a stable `key`, not an index; `onVersionChange` reports the key |
| assistant-ui | [#8037](https://github.com/assistant-ui/assistant-ui/issues/8037), [#8050](https://github.com/assistant-ui/assistant-ui/issues/8050) | feedback submitted while a message streams, or that lands after a run settles, leaves the message running or drops the final write; title only | not read; feedback races the run | closed | a feedback press while the message streams is a normal event with its own status; the component never writes message state |
| assistant-ui | [#8816](https://github.com/assistant-ui/assistant-ui/issues/8816), [#7352](https://github.com/assistant-ui/assistant-ui/issues/7352) | Speak stays enabled without an adapter; edit, reload, speak, feedback throw on voice transcript messages; title only | action offered where it cannot run | closed | an action the consumer does not provide is absent, not a dead button; `unavailable` actions are `aria-disabled` only while the consumer says they are temporarily unavailable |
| assistant-ui | [#8002](https://github.com/assistant-ui/assistant-ui/issues/8002) (open) | no way to add a product-specific control to the message row without forking | the row is closed | open | the row is an open set of parts: any `Item` (button-like) joins the toolbar |
| assistant-ui | `ActionBarRoot.tsx` (source, no issue) | hidden bar is unmounted, so a focused action vanishes when hover ends or a run starts | `return null` | open (by design) | never unmount on hide: visually hide with `data-active`, keep in the tab order while focus-within |
| AI Elements | [#419](https://github.com/vercel/ai-elements/issues/419), [#420](https://github.com/vercel/ai-elements/issues/420) | `overflow-hidden` on `MessageContent` made sticky Copy and Download buttons of the code block unclickable | a clipping ancestor breaks `position: sticky` | #419 closed, #420 open (#420 title only) | the row never sets overflow on the message; layout is the theme's |
| AI Elements | [#33](https://github.com/vercel/ai-elements/issues/33) | documented hover reveal of the actions does not exist in the code | docs and code drift | closed | visibility lives in `data-*` and is tested in the contract, not in docs |
| AI Elements | [#183](https://github.com/vercel/ai-elements/issues/183) (open) | no MessageEditor | feature | open | edit is a trigger and a state; the editor is the consumer's Prompt Input |
| AI Elements | `message.tsx` (source, no issue) | `MessageBranchNext` wraps from the last to the first; static "Previous branch" labels; no announcement | design | open (by design) | no wrap by default (the user loses where the end is); labels name the target ("Version 1 of 3") |
| Open WebUI | [#32610](https://github.com/open-webui/open-webui/issues/32610) | icon-only buttons in a chat announced only as "button" | no accessible name | closed | `Item` requires a name: `label` is a required prop or `aria-label` from messages |
| Open WebUI | [#32904](https://github.com/open-webui/open-webui/issues/32904), [#32633](https://github.com/open-webui/open-webui/issues/32633) | copy result is only an icon swap or a toast; not announced | no status message | closed | the result goes through the Announcer |
| Open WebUI | [#32603](https://github.com/open-webui/open-webui/issues/32603) | a control that appears on hover stays invisible when tabbed to | hover-only reveal | closed | reveal on `:hover`, `:focus-within` and always on touch (`data-active`) |
| Open WebUI | [#30053](https://github.com/open-webui/open-webui/issues/30053), [#30961](https://github.com/open-webui/open-webui/issues/30961), [#32333](https://github.com/open-webui/open-webui/issues/32333) | switching a rated reply to the other thumb keeps the old score and reason; a copy keeps the original's rating; a saved reason is wiped seconds later | feedback state not replaced as one value | closed | feedback is one value (`"up" \| "down" \| null`); switching replaces it whole |

## Accessibility decisions

- **The row is a Toolbar** when it has three or more items, a named `role="group"` below that:
  the toolbar machine already exists (toolbar.md), the count of items is known from the
  collection. Name: `aria-label` "Message actions" by default, with the message's speaker
  and position when the thread gives one ("Actions for message 4").
- **One Tab stop per message**, roving inside; Left / Right; Home / End. A text field in the
  row (none by default) keeps its own keys (toolbar.md rule 3).
- **Never unmounted, never `display: none` while focus is inside.** The row's visibility is
  `data-active` (pointer over the message, focus within, or the last message, or touch);
  the theme uses opacity and `pointer-events`, never `display` or `visibility` that removes
  the focused control from the tab order (assistant-ui `return null`; Open WebUI #32603).
  When the row must stay open (a menu from a "More" item), the same lock idea as
  assistant-ui's interaction lock applies: `data-active` holds while a descendant has
  `aria-expanded="true"`.
- **Names**: every item has a text name ("Copy", "Regenerate response", "Edit message",
  "Good response", "Bad response", "Previous version", "Next version"); the visible icon is
  `aria-hidden`; a visible tooltip repeats the name and is not required for it
  (name, not tooltip: AI Elements' `label || tooltip` can leave a button nameless).
- **Thumbs**: `aria-pressed`; one value in a Toggle Group (single); pressing the active thumb
  clears it. The group is named "Rate this response".
- **Copy**: reuses Clipboard: stable name, result announced politely ("Copied" /
  "Copy failed"), repeated presses re-announced (a new node per message).
- **Regenerate**: while it runs the button is `aria-disabled` (not `disabled`: focus stays)
  with `aria-busy`; a second press is ignored (no double submission); the start is not
  announced by the row (the Streaming Message announces the new response); a rejected promise
  announces "Regenerate failed" and returns to idle.
- **Edit**: `editing` is a bound prop. Entering it moves nothing (the consumer's composer
  takes focus); leaving it returns focus to the Edit item **only if focus is on `<body>` or
  inside the edit region** (assistant-ui #8208), never when the user moved on.
- **Versions**: `Previous` and `Next` are buttons; at an end they are `aria-disabled` with
  `focusableWhenDisabled` (toolbar.md default) so focus is not dropped when the last press
  disables the button (a plain `disabled` button loses focus); no wrap by default
  (`loop` is a prop, default `false`, unlike the roving focus loop). The counter text
  "2 / 3" is `aria-hidden` and replaced by an accessible "Version 2 of 3". A change is
  announced (polite) as "Version 2 of 3"; focus stays on the pressed button. The inactive
  versions are not in the accessibility tree (`hidden`), as AI Elements does with CSS.
- **Reduced motion and forced colors**: pressed state is not colour alone.

## Testing notes

- Machine in Node: per-action status (`idle | pending | done | error`), re-press ignored while
  `pending`, feedback replacement, version index bounds and wrap off, `editing` focus return
  rules, `data-active` derivation (hover, focus-within, lock).
- Browser (three engines): Tab count per message equals one; roving keys; `aria-pressed`
  after press; focus never on `<body>` after each action, after regenerate replaces the
  message, after the edit composer closes with Escape and with Cancel, after the last
  version press disables Next; announcements (recording Announcer) for copy, version
  change, failure; axe with the row hidden (opacity) and shown; touch emulation shows the
  row.
- Property: for any sequence of presses and external message replacements, focus is on an
  action, the row, or the message article, never `<body>`.

## Decisions for `add-message-actions`

- **Composition over a new machine per action**: `Root` is the Toolbar host (composite host
  of toolbar.md); items are existing machines: `Copy` = Clipboard's copy machine,
  `Feedback` = Toggle Group (single), the rest are Buttons. A thin `message-actions` machine
  owns only what is new: `active` (visibility), `editing`, per-action `status`, `version`.
- **Parts**: `Root` (toolbar or group, named), `Item` (any button-like: `render` / `asChild`;
  consumers add their own, assistant-ui #8002), `Copy`, `Regenerate`, `Edit`, `Feedback`
  (the Toggle Group) with `FeedbackItem value="up" | "down"`, `Versions` (`role="group"`,
  named "Versions"), `VersionPrevious`, `VersionNext`, `VersionStatus` (the visible "2 / 3").
  The Root is required; every other part is optional.
- **Machine states**: Root `inactive | active`; action status `idle | pending | done | error`
  per `Copy`, `Regenerate`. Events `HOVER`, `LEAVE`, `FOCUS_IN`, `FOCUS_OUT`, `LOCK` /
  `UNLOCK`, `PRESS { action }`, `ACTION.DONE`, `ACTION.FAILED { error }`, `EDITING.CHANGE`,
  `VERSION.GO { to }`. Press while `pending` is ignored.
- **Props**: Root `active?: boolean` (force), `lang`, `messages`; `Copy` `value: string |
  (() => string)` (read at press time), `onCopy`; `Regenerate` `onRegenerate(): void |
  Promise<void>`; `Edit` `editing`, `onEditingChange`; `Feedback` `value`, `defaultValue`,
  `onValueChange` (`"up" | "down" | null`); `Versions` `count`, `index` (controllable),
  `keys?: string[]`, `onIndexChange({ index, key })`, `loop` (default false).
- **`data-*`**: `data-scope="message-actions"`; Root `data-active`, `data-focus-within`,
  `data-orientation`; Item `data-part`, `data-state` (`idle | pending | done | error`),
  `data-disabled`, `data-focus-visible`; Feedback item `data-state` (`on | off`); Versions
  `data-count`, `data-index`; `data-position="first" | "middle" | "last"` on version buttons.
- **Contract**: locate by the toolbar's name, else the only Message Actions in the target.
  Actions `copy`, `regenerate`, `edit`, `rate("up" | "down")`, `previousVersion`,
  `nextVersion`, `hover()`, `focus()`. Queries `items` (names), `status(action)`,
  `rating`, `version` (`{ index, count }`), `isActive`, `announcements`, `tabStops`.
- **Reuse**: Toolbar (focus), Toggle Group (rating), Clipboard (copy), Announcer, Button.
- **Deliberately different**: not unmounted on hide (assistant-ui); names required (AI
  Elements); versions keyed, no wrap and announced (AI Elements wraps, silent); focus rules
  as machine rules, not docs; the row counts as one Tab stop.
- **Non-goals**: what regenerate or edit do; the editor; the message tree and branch storage;
  text to speech, export and share actions (consumer `Item`s); the "More" menu (Menu
  composed inside an `Item`); toasts; rating forms (a Popover the consumer opens from
  `FeedbackItem`).

## Open questions

- **Toolbar or group by item count**: the APG threshold is three; a message with two actions
  gets a group. Is a role that changes with content confusing in a transcript where
  neighbouring messages differ? Decide with the tier-1 AT pass; the fallback is always
  `toolbar`.
- **Where the row lives for a screen reader reading the article**: inside the message
  article (before or after its text) or as a sibling? Message Thread decides the article
  boundary; this note assumes inside, after the content.
- **Announcing a version change** duplicates what the user hears when the message content
  also changes in a live region (it should not, the thread is not live). Verify there is no
  double read.
