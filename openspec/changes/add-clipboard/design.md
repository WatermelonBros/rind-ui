## Context

The research note ([clipboard.md](../../../docs/research/clipboard.md)) compares Zag / Ark,
Mantine, Chakra and React Aria's `useClipboard`, and the trackers of the copy utilities they
sit on (VueUse, copy-to-clipboard, clipboard.js). rind-ui's `clipboard` capability
(`env.clipboard.writeText(text, { near })`, Clipboard API first, then a read-only textarea next
to `near` copied with `execCommand`, then a rejection) and `fakeClipboard` already exist from
`add-code-block`, as does Code Block's copy graph `idle → copying → copied | error → idle`.

## Goals / Non-Goals

**Goals:**
- One copy graph, written once: Clipboard and Code Block share the write effect and the
  announcement.
- The result comes from the write, never before it; failure is a first-class, visible and
  announced state.
- Every transition runs in Node with the fake clipboard, a virtual scheduler and a recording
  announcer.

**Non-Goals:**
- A new Environment capability: `ClipboardEnv`, `SchedulerEnv` and `AnnouncerEnv` cover it.
- Changing the DOM clipboard implementation (its iOS font-size question is an open question
  of the research note, for its own change).

## Decisions

### 1. Anatomy

Ark's anatomy, because it is the only shipping component and its parts each have a job:
`Root` (div), `Label` (label), `Control` (div grouping Input and Trigger), `Input`
(`input readonly`), `Trigger` (button), `Indicator` (span, `aria-hidden`), `ValueText` (span).
Only `Root` and `Trigger` are required: a bare copy button is `Root` + `Trigger`. The Root
registers which parts are rendered (`usePartRegistry`), so `for` and `aria-labelledby` never
point at a missing element.

### 2. Machine

```ts
type ClipboardEvent =
  | { type: "COPY" }
  | { type: "COPY.DONE" }
  | { type: "COPY.FAILED"; error?: unknown }
  | { type: "INPUT.COPY"; whole: boolean }
```

States `idle`, `copying`, `copied`, `error`:

- `idle`: `COPY` (guard `enabled`) → `copying`; `INPUT.COPY` (guard `whole`) → `copied`.
- `copying`: effect `writeClipboard` → `COPY.DONE` → `copied`, `COPY.FAILED` → `error`.
  `COPY` is ignored (no second write while one is pending).
- `copied` / `error`: entry `reportCopied` / `reportFailed`, `after: { feedback: "idle" }`,
  `COPY` → `copying` (copies again; the timer restarts when the new result arrives),
  `INPUT.COPY` (whole) → `copied` (re-entered: report again, timer restarts).

Props: `value: string`, `id`, `messages`, `lang`, `copyFeedbackDuration` (default 2000),
`disabled`, `onCopy(details)`, `getCopyAnchor()`. `value` is read when the write starts, so a
value that changed since render is the one copied (Chakra#6923). No `defaultValue`, no
`onValueChange`, no context: nothing inside the component edits the value.

`CopyDetails = { ok: true; source } | { ok: false; error: unknown; source }`, `source:
"trigger" | "input"`. A field copy is always `ok: true` (the browser copied it).

Write timing: the runtime activates state effects synchronously in the step that handles
`COPY`, and the React Trigger sends `COPY` from its `click` handler, so `writeText` is called
in the click's task — the WebKit user-activation rule (VueUse#5368). This is specified; a node test
asserts the call happens before the handler returns, and a WebKit browser test resolves a real
`writeText` from a trusted click (when the automation build allows clipboard access).

`disabled` becoming true while `copying` does not cancel the write: the result is still
reported (the copy happened).

### 3. Shared copy module

`components/clipboard/copy.ts` exports the `writeClipboard` effect (one write per entry to
`copying`, a result after leaving the state is dropped, a synchronous throw becomes a
rejection) and `announceCopy(env, { id, lang, message, scope })`. Clipboard's machine and Code
Block's machine both use them; Code Block's spec and tests are unchanged (refactor only). The
announcement key is `${scope}-${id}`, so two instances never coalesce each other's messages.

### 4. Connect

Parts and attributes (every part: `data-scope="clipboard"`, `data-part`, `data-instance`,
`data-state`, `data-disabled` while disabled):

- `trigger`: `button-like-element` (`type="button"`, native `disabled`), `aria-label` =
  `messages.copy`, and when the Label is rendered `aria-labelledby="<trigger id> <label id>"`
  (name "Copy API key"). Consumer `aria-label` / `aria-labelledby` props win (merged last).
  `data-focus`, `data-focus-visible`. The name never depends on the state.
- `label`: `id`; `htmlFor` the Input when it is rendered.
- `input`: `readOnly`, `value` (controlled from the prop, never `defaultValue`),
  `aria-labelledby` the Label when rendered, `disabled` when disabled, `data-focus*`,
  `spellCheck=false`, `autoComplete="off"`. Handlers: on focus by keyboard, select all; on the
  first pointer press that focuses it, select all after the press (the following `mouseup`
  would otherwise collapse the selection in Safari and Chrome); later presses keep native
  selection; on `copy`, send `INPUT.COPY` with `whole = selectionStart === 0 && selectionEnd
  === value.length` (and the value is not empty).
- `indicator`: `aria-hidden="true"`.
- `control`, `value-text`, `root`: base attributes only.

`messages`: `copy` ("Copy"), `copied` ("Copied"), `copyFailed` ("Copy failed").

### 5. React

`Clipboard.Root` owns the machine (props from §2, `messages`, `locale`), the part registry and
the render state `{ copyState, value }`. `Clipboard.Trigger` sends `COPY` on `click` (an AT
press is a bare click; cause A) and is the copy anchor. `Clipboard.Indicator` renders
`children` in `idle` / `copying`, its `copied` prop in `copied` and its `failed` prop in
`error` (each falling back to `children`). `Clipboard.ValueText` renders `children ?? value`.
Every part accepts `render`.

### 6. Contract

`clipboardContract`: anatomy `root`, `label`, `control`, `input`, `trigger`, `indicator`,
`value-text`; locate by the Label's text, else the only Clipboard in the target. Actions:
`copy` (pointer click, touch tap, keyboard Enter), `settleCopy` (advances fake time in 10 ms
steps until the state is not `copying`), `copyFromInput` (focus, select all,
`copySelection()`), `copyPartOfInput(n)` (select the first `n` characters, `copySelection()`).
Queries: `copyState`, `value` (ValueText or Input), `inputValue`, `triggerName`,
`isDisabled`. Event mapping: `COPY` → `copy`, `COPY.DONE` / `COPY.FAILED` → `settleCopy`,
`INPUT.COPY` → `copyFromInput`. The clipboard's verdict is the fake's mode, so the model test
runs each configuration with the fake set to `succeed` and to `reject`.

`Part.copySelection()` (new, in `contract/env.ts`): dispatches a cancelable, bubbling `copy`
`ClipboardEvent` at the focused element with the current selection (DOM adapter), or presses
`ControlOrMeta+C` (Playwright adapter). It writes nothing to the OS clipboard in the DOM
adapter; tests assert the component's state, not the clipboard.

### 7. Model configurations

trigger only; Label + Control + Input + Trigger + Indicator; disabled; fake `reject`; fake
`absent`; fake with latency (so `copying` is observed). Every modality in browser mode, keyboard
and pointer in jsdom.

### 8. Theme

`clipboard.css` in `@layer rind.components`, `:where()` selectors, logical properties:
`clipboard` joins the `field` family (`outline`, `soft`; sizes `sm`/`md`/`lg`): the Control is
the field surface, the Input fills it, the Trigger sits at its end with the button's `ghost`
look. Without a Control, the Trigger is a standalone ghost icon button (≥ 24 × 24 CSS px). The
Indicator draws a mask icon from `@rind-ui/theme`'s icon set: `copy` in `idle` / `copying`,
`check` in `copied`, `x` in `error` (the shape changes, not only the colour); `copied` uses the
`success` tone, `error` the `danger` tone. Forced colors: the mask is painted with
`ButtonText` / `CanvasText`; transitions off under reduced motion.

## Risks / Trade-offs

- `messages.copy` is an `aria-label`: when the consumer shows text in the Trigger they must set
  `messages.copy` to it (WCAG 2.5.3, label in name). The docs page and the site example show
  this; a dev warning is not added (no reliable way to read rendered text on the server).
- A field copy is reported as success without a write: the browser's own copy cannot fail
  visibly to a page.
- The real clipboard is read back only in Chromium under automation; Firefox and WebKit run
  with the fake, plus the WebKit write-timing test (§2), which asserts the promise resolves.
