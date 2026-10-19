# Clipboard — research

Status: done · Wave: 3

A Clipboard is a "copy this value" control: a value (an API key, a URL, an install command), an
optional read-only field that shows it, and a button that writes it to the system clipboard and
says whether that worked. Of the nine libraries only Ark/Zag ships one as a component. Mantine
has `CopyButton` and the `useClipboard` hook, Chakra v3 re-exports Ark's, and VueUse,
`copy-to-clipboard` and clipboard.js are the copy utilities most components sit on. React Aria
has no copy button; its `useClipboard` handles the native copy/cut/paste events of a focused
element, a different job. rind-ui already owns half of this: Code Block (archived
`add-code-block`) added the injected `clipboard` capability (`env.clipboard.writeText`, the DOM
implementation with the `execCommand` fallback, `fakeClipboard` for tests) and a copy state
machine inside Code Block. This note records how the others built the component, the bug
history of copying text in browsers, and the decisions for `add-clipboard`.

Builds on [code-block.md](code-block.md) (the copy state machine, the clipboard capability and
its first bug table), [button.md](button.md) (`button-like-element`, press), the `announcer`
spec, and the cross-cutting notes [accessibility.md](accessibility.md) §7 (live regions),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes A, D, H, and
[native-platform.md](native-platform.md) §13 (`ariaNotify`).

Sources read (local shallow clones, 2026-10-19):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/clipboard/src/{clipboard.machine,clipboard.connect,clipboard.dom,clipboard.types,clipboard.anatomy}.ts`, `CHANGELOG.md`; `ark/packages/react/src/components/clipboard/{clipboard-root,clipboard-trigger,clipboard-indicator,clipboard-input,clipboard-value-text,clipboard-control}.tsx`, `examples/*` |
| Mantine | `@mantine/hooks/src/use-clipboard/use-clipboard.ts`, `@mantine/core/src/components/CopyButton/CopyButton.tsx`, `code-highlight/src/CodeHighlight/CopyCodeButton` |
| React Aria | `packages/react-aria/src/dnd/useClipboard.ts` (copy/cut/paste events, not a copy button) |
| rind-ui | `core/src/dom/clipboard.ts`, `core/src/env/capabilities.ts` (`Clipboard`), `core/src/components/code-block/code-block.machine.ts`, `testing/src/fake-clipboard.ts`, `openspec/specs/clipboard/spec.md` |
| Utilities (issue trackers) | VueUse `useClipboard`, `sudodoki/copy-to-clipboard` (Chakra v2's), `zenorocha/clipboard.js`, `sindresorhus/copy-text-to-clipboard` (Docusaurus's) |

Radix, Base UI, Headless UI, Ariakit, Reka UI, Bits UI and Kobalte ship no Clipboard and have
no open request for one on their trackers (search "clipboard", 2026-10-19).

## Pattern

- WAI-ARIA APG: **none** for a copy control. It is the
  [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) pattern (accessibility.md §1.5 lists
  "Clipboard trigger" under Button) plus a status message (WCAG 4.1.3: the result must be
  programmatically determinable without moving focus), plus an optional read-only text input.
- Roles and attributes: `button` with a name (native `<button type="button">`); a read-only
  `<input readonly>` labelled by the Label; the result reaches AT through a polite live region.
  No `aria-pressed` (copying is an action, not an on/off state), no `aria-live` on the button.
- Keyboard: Tab reaches the input (if rendered) and the button; Enter and Space copy (native
  button). Nothing else.

## How the others built it

| | Zag / Ark | Mantine `CopyButton` | Chakra v2 `useClipboard` | rind-ui Code Block |
|---|---|---|---|---|
| Parts | Root, Label, Control, Input, Trigger, Indicator, ValueText | none (render function `{ copied, copy }`) | none (hook) | CopyTrigger inside the block |
| States | `idle`, `copied` | `copied` boolean, `error` (hook only) | `hasCopied` | `idle`, `copying`, `copied`, `error` |
| Decided by the write? | **no**: `copied` entered, write not awaited | yes (`.then`) | yes (sync `execCommand` result) | yes (promise settles) |
| Fallback | `pre` + selection + `execCommand` | none | `copy-to-clipboard` (a span, then `window.prompt`) | readonly textarea next to the trigger, focus and selection restored |
| Timeout | 3000 ms, `setRafTimeout` | 1000 ms (hook 2000), restarts | 1500 ms | 2000 ms via Scheduler, restarts |
| Feedback to AT | trigger `aria-label` swaps "Copy to clipboard" / "Copied to clipboard" | consumer (docs show a Tooltip) | consumer | Announcer, polite; name unchanged |
| Copy from the field | `INPUT.COPY` (native `copy` event on the input) → `copied` | — | — | — |
| Error reporting | none | `error` in the hook, dropped by `CopyButton` | `console` with `debug` | `onCopy({ ok: false, error })`, `data-state="error"`, announced |

### Zag.js / Ark UI

- Source: `clipboard.machine.ts` (95 lines), `clipboard.connect.ts`, `clipboard.dom.ts`; Ark adds
  thin parts. Indicator renders `copied` when copied, else `children`; ValueText renders
  `children || value`.
- API: `value` / `defaultValue` / `onValueChange` (a bindable, because `api.setValue` exists),
  `timeout` (3000), `onStatusChange({ copied })`, `translations.triggerLabel(copied)`, `ids`.
  API: `copied`, `value`, `setValue`, `copy()`.
- State model: `idle | copied`. Root-level `COPY` → `copied` with actions `copyToClipboard` and
  `invokeOnCopy`; `copied` runs `waitForTimeout` (`setRafTimeout`) → `COPY.DONE` → `idle`.
  `INPUT.COPY` (the input's native `copy` event) → `copied`. `watch(value)` writes the input's
  value with `setElementValue`, because the input is rendered with `defaultValue`.
- Notable:
  - The anatomy is the right size and the one to match: a field that shows the value, a
    trigger, an indicator that swaps the icon, a text rendering of the value.
  - Every part carries `data-copied`, so any part can be styled by the result.
  - The input selects its whole value on focus.
  - Copying from the field by hand also gives the "copied" feedback.
- Problems (from the source; the tracker has no clipboard bug, the changelog has three fixes):
  - `copied` is entered **before** `writeText` settles and its promise is never awaited: a
    rejected write (insecure context, permission policy, Safari without user activation) still
    shows "Copied" and fires `onStatusChange({ copied: true })`. No error state.
  - The trigger's accessible name changes with the state ("Copy to clipboard" → "Copied to
    clipboard"). Most screen readers do not announce a name change on the focused element
    (code-block.md bug table; cause H), and every trigger on a page has the same name, which
    fails WCAG 2.4.6 when several values sit side by side.
  - The fallback copies a styled `<pre>` through a document selection: browsers put
    `text/html` with computed styles on the clipboard, so pasting into a rich editor pastes a
    coloured block (the same bug Chakra fixed, chakra#3921). The `pre` is appended to `body`,
    so inside a modal dialog it is inert and the copy fails (chakra#414, docusaurus#11109), and
    focus and the previous selection are lost.
  - `INPUT.COPY` fires for any copy in the input, including a partial selection: "copied" is
    shown for text that is not the value.
  - The input uses `defaultValue` and a watcher that writes the DOM value: a controlled value
    is mirrored late and outside React.
  - Fixed in the changelog: the trigger had no `type="button"`, so inside a form it submitted
    it (0.77.1); `translations` were missing (zag#3004); `onCopyStatusChange` renamed to
    `onStatusChange`; `isCopied` renamed to `copied`.
  - `setRafTimeout` does not run while the tab is hidden, so `copied` outlasts its timeout in
    a background tab (harmless, but not the documented duration).

### Mantine

- Source: `use-clipboard.ts` (60 lines), `CopyButton.tsx` (render function only).
- `copy(value)` checks `'clipboard' in navigator`, awaits `writeText`, sets `copied` and a
  `window.setTimeout` that is cleared and restarted on each copy; on rejection it sets `error`.
  `reset()` clears both. `CopyButton` passes `{ copied, copy }` to its children and drops
  `error`.
- Notable: the result is decided by the promise; the timer restarts on a second copy; the
  timeout is configurable per button.
- Problems:
  - No fallback: in an insecure context (plain HTTP, a LAN IP, a custom local domain) or a
    WebView without the API nothing is copied and **nothing is shown**, because `CopyButton`
    ignores `error` (mantine#2298 mobile WebView, mantine#3271 "does not work on production
    build", both closed: "nothing can be done on library side").
  - Accessibility is left to the consumer; the docs example puts "Copied" in a Tooltip, which
    is not announced.
  - `copy(value: any)` accepts non-strings.

### Chakra UI

- v3: re-exports Ark's Clipboard (same machine, same issues); Code Block uses it.
- v2 `useClipboard` (history only): built on `copy-to-clipboard`, whose fallback opened a
  `window.prompt("Copy to clipboard: Ctrl+C, Enter")` when `execCommand` failed. Users saw a
  "weird dialog box" in Safari 17 (chakra#8052, fixed by switching to `navigator.clipboard`).
  The selection-based copy put styled HTML on the clipboard (chakra#3921, workaround
  `format: "text/plain"`). Inside a Drawer the focus trap blocked the fallback (chakra#414).
  The value moved from an argument to `setValue` in v2 and broke copying of dynamic input
  (chakra#6923, #6759, #7319): a value read at press time is the expected model.

### React Aria

- Source: `dnd/useClipboard.ts`. Listens to document-level `beforecopy`/`copy`/`cut`/`paste`
  while the element is focused and writes `DragItem`s into `clipboardData`. Notable for one
  detail: it `preventDefault`s `beforecopy` so Safari enables the Edit > Copy menu item for a
  non-text element. Not a copy button and not reused here; noted so a later "copy selected
  items" feature in collections starts from it.

### Utilities: VueUse, copy-to-clipboard, clipboard.js, copy-text-to-clipboard

- VueUse `useClipboard`: Clipboard API, `legacy` option for the `execCommand` fallback,
  `copied` for `copiedDuring` ms. Its tracker is the best record of browser failures (see Bug
  history).
- `copy-to-clipboard`: a span with `user-select: text`, a document selection, `execCommand`,
  then `clipboardData` (IE), then `window.prompt`. v4 moved to `navigator.clipboard.write`.
- clipboard.js: a fake `textarea` (readonly, 12 pt, positioned at the scroll offset), copy on
  `click` only.
- `copy-text-to-clipboard` (Docusaurus): a readonly `textarea`, `contain: strict`, 12 pt,
  previous selection and focus restored. rind-ui's fallback follows this one.

## Accessibility

Applying [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md):

- **Button.** A native `<button type="button">` (`button-like-element`): Enter and Space for
  free, an AT "press" is a bare `click` (cause A), so copy runs on `click`, never on
  `pointerdown`. `type="button"` so it never submits a surrounding form (the Zag fix).
- **Name.** Stable. The result is never put in the name (Zag's swap is not announced and
  changes the name under the user). Default `messages.copy` ("Copy"); when a Label is
  rendered, the trigger is named by itself plus the Label (`aria-labelledby="<trigger>
  <label>"` → "Copy API key"), so several copy buttons on a page have distinct names (WCAG
  2.4.6). A consumer `aria-label` / `aria-labelledby` wins. When the trigger shows text, the
  name must contain it (WCAG 2.5.3): the docs tell the consumer to set `messages.copy` to it.
- **Result.** Announced through the injected Announcer, politely, keyed per instance: "Copied"
  or "Copy failed" (the same choice as Code Block: a failed copy is not urgent and the
  user's focus has not moved; rule 25 allows assertive, and polite was chosen for one
  vocabulary across copy controls). The announcer's regions exist before the first message,
  every message is a new node, so a second "Copied" is spoken (accessibility.md §7.1, cause
  D). The announcement carries the component's `lang`. The button keeps focus; nothing moves.
- **Indicator.** The icon swap is visual only: `aria-hidden="true"`. The state is also in
  `data-state`, so the theme changes the icon's **shape** (copy → check → x), not only its
  colour (WCAG 1.4.1).
- **Input.** `<input readonly>` (implicitly `aria-readonly`), named by the Label, focusable,
  so keyboard and screen reader users can read and select the value; a focus that comes by
  keyboard or by the first click selects the whole value. `readonly` inputs are still in the
  tab order (they are not disabled), which is what users of read-only fields expect.
- **Timing.** The "copied" visual lasts `copyFeedbackDuration`; the announcement does not
  depend on it, so the timeout is not a WCAG 2.2.1 time limit (nothing is lost when it ends).
  Rule 27 (pause timers while hovered or focused) applies to dismissing content, not to a
  state badge, and is not applied.
- **Forced colors, motion, size.** Icons are masks painted with `currentColor`
  (`CanvasText`/`ButtonText` in forced colors); the icon transition is off under reduced
  motion; the trigger is at least 24×24 CSS px (WCAG 2.5.8).
- **The fallback and screen readers.** The fallback focuses a hidden textarea for one tick.
  `copy-to-clipboard#119` shows ChromeVox reading the whole copied text when its span was
  selected; rind-ui's textarea is `aria-hidden`, read-only and focus returns synchronously, but
  this is verified by hand (manual protocol), not by axe.
- **Native platform.** There is no native copy button and no `command="copy"` invoker
  ([native-platform.md](native-platform.md) §3 lists none). `navigator.clipboard.writeText`
  is the platform API; `execCommand("copy")` is deprecated but still the only path in
  insecure contexts and some WebViews. `ariaNotify` sits behind the Announcer already.

## Bug history

Search: the trackers above for "clipboard", "copy", "CopyButton", "useClipboard" (open and
closed), ~120 hits, ~30 read. Zag/Ark have no clipboard bug issues; their entries come from
the source and the changelog.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag / Ark | `clipboard.machine.ts` | "Copied" shown when nothing was copied | `copied` entered before `writeText` settles, promise not awaited | open (by design) | `copying` → `copied` \| `error`, decided by the promise |
| Zag / Ark | `clipboard.connect.ts` | result not heard by screen readers; identical button names | result put in the trigger's `aria-label` | open | stable name + Label in the name; result through the Announcer |
| Zag | 0.77.1 changelog | pressing Copy submitted the form | trigger had no `type="button"` | fixed | `button-like-element` gives `type="button"` |
| Zag / Ark | `clipboard.connect.ts` `onCopy` | "copied" after copying part of the field | any `copy` event in the input counts | open | field copy counts only when the whole value is selected |
| Mantine | [#3271](https://github.com/mantinedev/mantine/issues/3271), [#2298](https://github.com/mantinedev/mantine/issues/2298) | button does nothing in production / in a mobile WebView | no Clipboard API (insecure context, WebView), no fallback, error dropped | closed, won't fix | fallback, and a visible and announced `error` state |
| Chakra | [#8052](https://github.com/chakra-ui/chakra-ui/issues/8052) | Safari shows a "Copy to clipboard: ⌘C" dialog | `copy-to-clipboard` falls back to `window.prompt` | fixed (Clipboard API first) | never prompt; reject and report |
| Chakra | [#3921](https://github.com/chakra-ui/chakra-ui/issues/3921) | pasted text has a dark background | selection of a styled node copies `text/html` | workaround `format` | fallback copies from a `textarea` (plain text only) |
| Chakra | [#414](https://github.com/chakra-ui/chakra-ui/issues/414) | nothing copied inside a Drawer | fallback node outside the focus trap / modal layer | fixed | fallback node next to the trigger (`near`), already in the capability |
| Chakra | [#6923](https://github.com/chakra-ui/chakra-ui/issues/6923), [#7319](https://github.com/chakra-ui/chakra-ui/issues/7319) | dynamic value not copied after an upgrade | value captured once, moved to `setValue` | closed | copy reads `value` at press time; `value` is a plain prop |
| VueUse | [#5368](https://github.com/vueuse/vueuse/issues/5368) | Safari copies nothing when the text is fetched first | WebKit requires the write in the user-gesture task; an `await` before `writeText` loses it | closed (async source added) | `writeText` is called synchronously in the click's task; async values are a non-goal (see Open questions) |
| VueUse | [#5178](https://github.com/vueuse/vueuse/issues/5178) | fallback fails in Safari 15 | `select()` on an editable textarea does not copy | fixed (`readonly`) | fallback textarea is `readonly` (already) |
| VueUse | [#2494](https://github.com/vueuse/vueuse/issues/2494) | "Clipboard API has been blocked because of a permissions policy" in an iframe | API present but rejected; no fallback after a rejection | closed | fall back after a rejection, not only when absent (already) |
| VueUse | [#1639](https://github.com/vueuse/vueuse/issues/1639) | `copy()` resolves without the API | unsupported treated as success | fixed | absence is a failure: `error` |
| VueUse | [#5539](https://github.com/vueuse/vueuse/issues/5539) (open) | callback called twice | `ClipboardItem` path and its fallback both report | open | one result per press; a late result after leaving `copying` is dropped |
| VueUse | [#937](https://github.com/vueuse/vueuse/issues/937) | `clipboard.readText is not a function` in Firefox | feature test on `navigator.clipboard`, not on the method | fixed | test `typeof writeText === "function"` at call time (already) |
| copy-to-clipboard | [#119](https://github.com/sudodoki/copy-to-clipboard/issues/119) | screen reader reads the whole copied text | the selected fallback node is read | fixed 3.3.2 | fallback node `aria-hidden`, focus restored at once; manual check |
| copy-to-clipboard | [#127](https://github.com/sudodoki/copy-to-clipboard/issues/127) | nothing copied in fullscreen | fallback node appended to `body`, outside the fullscreen element | open PRs | `near` keeps the node inside the fullscreen element |
| copy-to-clipboard | [#124](https://github.com/sudodoki/copy-to-clipboard/issues/124) (open) | `\r\n` becomes `\n\n` in Firefox | selection serialisation of a span | open | textarea fallback; the value is copied as given |
| copy-to-clipboard | [#138](https://github.com/sudodoki/copy-to-clipboard/issues/138), [#109](https://github.com/sudodoki/copy-to-clipboard/issues/109) | Safari `NotFoundError`; async copy fails | WebKit user-activation rules | fixed in v4 (`clipboard.write`) | same as VueUse#5368 |
| copy-to-clipboard | [#143](https://github.com/sudodoki/copy-to-clipboard/issues/143) (open) | Android WebView: nothing copied | neither API nor `execCommand` allowed by the host app | open | both paths can fail: `error` must be reachable and shown |
| clipboard.js | [#347](https://github.com/zenorocha/clipboard.js/issues/347), [#250](https://github.com/zenorocha/clipboard.js/issues/250) | page scrolls on copy (iOS, Chrome Windows) | focusing the fake element scrolls to it | fixed (position at scroll offset) | `focus({ preventScroll: true })` and `near` (already) |
| clipboard.js | [#180](https://github.com/zenorocha/clipboard.js/issues/180) | iPhone zooms in on copy | focused textarea font smaller than 16 px | fixed (12 pt) | see Open questions: check the fallback textarea's font size on iOS |
| clipboard.js | [#220](https://github.com/zenorocha/clipboard.js/issues/220) | iOS keyboard opens on copy | editable fake element focused | fixed (`readonly`) | `readonly` (already) |
| Docusaurus | #11791, #11109 (code-block.md) | `writeText` of undefined on HTTP; nothing copied in a modal | no API check; node outside the modal | fixed | already in the capability |

## Known pitfalls

- **"Copied" before the write settles** (Zag): the most common bug, and silent. The state
  must come from the promise.
- **Insecure contexts and WebViews** (Mantine, VueUse, Docusaurus): `navigator.clipboard` is
  undefined on plain HTTP, on LAN IPs and in some WebViews; it exists but rejects in an iframe
  without `allow="clipboard-write"` and when permission is denied. The capability tries the
  API, then the fallback, then rejects. Do not query `navigator.permissions` for
  `clipboard-write`: Firefox and Safari throw on that name.
- **User activation** (Safari, Firefox): the write must start inside the click's task. Any
  `await` (fetching the value, a deferred effect, `requestAnimationFrame`) before
  `writeText` makes WebKit reject it. rind-ui's runtime starts state effects synchronously in
  the step that handles the event, and `domClipboard` calls `writeText` before its first
  `await`; the spec makes this a SHALL so a refactor cannot break it.
- **Layers** (Chakra#414, Docusaurus#11109, copy-to-clipboard#127): the fallback node must sit
  inside the trigger's modal layer, focus trap or fullscreen element.
- **Rich text** (Chakra#3921): a selection of rendered nodes copies HTML; only a textarea copies
  plain text.
- **Partial copy** (Zag): a native copy from the field is the value only when the whole value
  is selected.
- **Name swap** (Zag): announcing by changing the focused button's name is not heard.
- **Identical names**: many "Copy" buttons on one page need the Label in their name.
- **Repeated "Copied"**: a live region with the same text is silent; the Announcer appends a
  new node per message, so a second press is heard.

## Testing notes

- **Node and jsdom**: inject `fakeClipboard` (exists, `@rind-ui/testing`): `succeed`,
  `reject`, `absent`, and a `latency` on a virtual scheduler so `copying` is observable. Every
  state and transition runs in Node.
- **Browser (three engines)**: the fake is injected for state tests. The real clipboard is
  read back only in Chromium (Playwright grants `clipboard-read` there; Firefox and WebKit
  cannot read the system clipboard under automation). The fallback path is already covered by
  `clipboard.dom.test.ts`.
- **Copy from the field**: the native `copy` event. Environments do not fire it for a key
  chord in jsdom, so the contract needs an Env action on a Part, `copySelection()`, the twin
  of `paste(text)`: it dispatches a cancelable `copy` `ClipboardEvent` at the selection
  (real `Meta`/`Control`+C in Playwright).
- **Time**: the feedback timeout runs on the injected Scheduler; tests advance fake time,
  never wait (RULES).
- **Driver** (`getClipboard`): actions `copy` (pointer, touch, keyboard), `settleCopy`,
  `focusInput`, `copyFromInput` (select all + copy), `copyPartOfInput`; queries `copyState`,
  `value`, `inputValue`, `selectedText`, `triggerName`, `announcements` (from the recording
  Announcer), `isDisabled`.
- Manual protocol: VoiceOver (macOS, iOS) and NVDA hear "Copied" once per press and do not
  read the copied text on the fallback path.

## Decisions

- **Parts** (Ark's anatomy): `Root`, `Label`, `Control`, `Input`, `Trigger`, `Indicator`,
  `ValueText`. Only `Root` and `Trigger` are required. `Label` labels the `Input` when there
  is one and joins the `Trigger`'s name. `Indicator` is `aria-hidden` and renders `children`,
  or its `copied` / `failed` content in those states. `ValueText` renders the value (or its
  children).
- **Machine**: states `idle | copying | copied | error`, the same graph as Code Block's copy.
  Events `COPY`, `COPY.DONE`, `COPY.FAILED { error }`, `INPUT.COPY { whole: boolean }`. Props
  `value: string` (read at press time, plain prop: no setter, no `defaultValue`),
  `copyFeedbackDuration` (2000), `disabled`, `onCopy(details)` with `{ ok: true, source }` or
  `{ ok: false, error, source }`, `source: "trigger" | "input"`, `messages`, `lang`. `COPY` is
  ignored while `copying` and when disabled; pressed again in `copied`/`error` it copies again
  and restarts the timer. `INPUT.COPY` with `whole` → `copied` without a write (the browser
  copied); a partial copy changes nothing.
- **Environment** (dependency inversion, no new capability): `ClipboardEnv` (write),
  `SchedulerEnv` (feedback delay), `AnnouncerEnv` (result). The write effect and the
  announcement are extracted from Code Block into one shared module both machines use; Code
  Block's behaviour does not change.
- **`data-*`**: `data-scope="clipboard"`, `data-part`, `data-state` (`idle | copying | copied
  | error`) on every part, `data-disabled`; focus attributes on Trigger and Input.
- **Contract**: locate by the Label's text, else the only Clipboard in the target. Actions
  `copy`, `settleCopy`, `copyFromInput`, `copyPartOfInput`; queries above; Env gains
  `Part.copySelection()`.
- **Theme**: `clipboard.css`; Control in the `field` family (input and trigger joined), the
  Trigger styled with the button's `ghost` attributes; Indicator icons from the icon set
  (`copy`, `check`, `x`) chosen by `data-state`.
- **Deliberately different from the others, and why**:
  - The result is decided by the write's promise (Zag reports success first).
  - The name never changes; the result is announced (Zag swaps `aria-label`).
  - The Label is part of the trigger's name (every library leaves "Copy" alone).
  - An explicit, styled, announced `error` state (Mantine and Ark have none in the UI).
  - A copy from the field counts only for the whole value (Zag counts any copy).
  - `value` is a plain prop: no `setValue` / `onValueChange`, because nothing inside the
    component edits it.

## Open questions

- **Async values** (VueUse#5368): Safari needs `navigator.clipboard.write([new
  ClipboardItem({ "text/plain": promise })])` to copy a value fetched after the click. That
  is a second method on the capability (`writeDeferred`?) and a `getValue` prop. Out of scope
  until a consumer needs it.
- **Rich formats** (`text/html`, images): the capability writes text only. Out of scope.
- **Imperative copy** (Ark's `api.copy()`, e.g. a keyboard shortcut): not in v1; the Trigger
  is the action. Revisit with the first request.
- **iOS zoom on the fallback** (clipboard.js#180): the fallback textarea's font size comes from
  `applyVisuallyHidden`; check on a real iPhone whether a focused, read-only, clipped textarea
  zooms. If it does, it is a fix to the capability (its own change), not to this component.
