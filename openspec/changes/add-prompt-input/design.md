## Context

See proposal.md for motivation and specs/prompt-input/spec.md for behaviour. Research, the
library comparison and the Bug history the scenarios cite:
[prompt-input.md](../../../docs/research/prompt-input.md). This change consumes, without
restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable()` (`value`, `attachments`), `bindProp()` (`status`, `disabled`, `submitKey`, `history`, limits), effects, contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter |
| `add-a11y-foundations` | `core/dom/keyboard` (IME guard incl. Safari's late Enter, `mod`, repeats), `core/dom/press` (Submit, AttachTrigger, Root press-to-focus; `preventFocusOnPress`), modality, `Environment.platform` (touch-primary), announcer, messages, invariants ("IME Never Commits") |
| `add-field`, `add-form` | `use-field-host` (Label, Description, describedby), `field-control` |
| `add-text-field` | `autosize-textarea` (`core/dom/autosize.ts`, `supportsFieldSizing`), `defaultCount`, `countAnnouncement`, the CharacterCount rules |
| `add-button` | `button-like-element` (Submit, AttachTrigger, `focusableWhenDisabled`) |
| `add-combobox`, `add-tags-input` | `input-chips` (helpers, events, context, contract fragment, messages) |
| `add-theme-system` | stylesheet convention, button family |

## Goals / Non-Goals

**Goals:**
- One guard decides "can submit"; every path asks it (no DOM queries).
- The request belongs to the consumer: callbacks and `status` in, no model, no transport.
- Native first: `<form>`, `<textarea>`, `field-sizing`, `<input type=file>`, `FormData`.
- Reuse what exists: no second IME guard, autosize, chips or count implementation.

**Non-Goals:**
- Mentions / Slash Commands and Suggestions (seams only), rich text, queueing, previews.

## Decisions

### 1. Machine (`core/ai/prompt-input/prompt-input.machine.ts`)

```
          COMPOSITION.START                    SUBMIT [submittable]
   idle ─────────────────────► composing    idle ───────────────────► submitting
   composing ──COMPOSITION.END | BLUR | INPUT{composing:false}──► idle
   submitting ──$sync:status=streaming──► streaming
   submitting | streaming | stopped ──$sync:status=idle | SETTLED{ok}──► idle
   submitting ──$sync:status=error | SETTLED{error} | THREW──► idle  / failSend (restore, announce)
   streaming  ──$sync:status=error | SETTLED{error}──► idle          / announceFailure
   submitting | streaming ──STOP [clickCount ≤ 1]──► stopped         / callOnStop, announceStopped
   stopped ──(no status prop, no pending promise)──► idle             (eventless, on entry)
root (every state): INPUT · PASTE · DROP.* · FILES.ADD · REJECT · RECALL · CHIP.* ·
                    BACKSPACE_EMPTY · $sync:value · $sync:attachments · $sync:disabled
```

```ts
type PromptInputEvent =
  | InputChipsEvent                                         // CHIP.NAVIGATE/REMOVE/TYPE, BACKSPACE_EMPTY
  | { type: "INPUT"; value: string; composing: boolean; event: Event }
  | { type: "COMPOSITION.START" } | { type: "COMPOSITION.END"; value: string } | { type: "BLUR" }
  | { type: "SUBMIT"; via: "enter" | "mod-enter" | "button" | "form" | "api"; event?: Event; composing: boolean; repeat: boolean }
  | { type: "STOP"; clickCount: number }
  | { type: "SETTLED"; token: number; ok: boolean }        // the onSubmit promise, by submit token
  | { type: "THREW"; error: unknown }
  | { type: "FILES.ADD"; files: readonly File[]; via: "picker" | "paste" | "drop" }
  | { type: "RECALL"; direction: "older" | "newer"; caret: "start" | "end" | "middle" }
```

- Guards: `submittable` (spec "Submittable": not disabled, state `idle`, text or
  attachments, none `pending`, not over the limit) **and** `keyNotComposing` (the shared IME
  guard) **and** `!repeat`. `composing` is entered from `idle` only: in busy states no key
  submits, so composition there needs only the `data-composing` flag (context
  `isComposing`, set by the same events in every state).
- `SUBMIT` actions: `snapshot` (`{ text, attachments }` + a token), `callOnSubmit`,
  `clearDraft` (reason `SUBMIT`), `clearAttachments` (reason `SUBMIT`). A returned promise
  is observed by a service that sends `SETTLED { token }`; a stale token (a later submit) is
  ignored. A synchronous throw sends `THREW`, then the service rethrows.
- `failSend`: assertive `sendFailedAnnouncement`; restore only when the draft is empty and
  there are no attachments (spec "Failed Send").
- `$sync:status` maps `status` changes; when `onSubmit` returned no promise and `status`
  is absent or still `"idle"` after it returns, the machine leaves `submitting` in the same
  run-to-completion step (eventless guard `notTracked`).
- Bound props: `status`, `disabled`, `submitKey`, `history`, `accept`, `maxFiles`,
  `maxFileSize`, `limit` (from CharacterCount's registration). Controllables: `value`,
  `attachments` (array equality by `id`).
- Context: `InputChipsContext` + `isComposing`, `pendingToken`, `snapshot`,
  `historyIndex`, `savedDraft`, `removing: Set<id>` (spec "Removed twice": a removal of an id
  already requested is dropped until the consumer's list no longer has it).
- API (`connect` returns it): `setValue(text, reason)`, `insertText(text)`, `submit()`
  (sends `SUBMIT { via: "api" }`), `stop()`, `focus()`, `openFilePicker()`.

*Alternatives:* a `status`-only design (assistant-ui's runtime) forces every consumer to
own a store; a promise-only design cannot express `streaming`. Both are accepted and map to
the same states. Parallel regions for composition × lifecycle: the runtime has none, and only
`idle` needs the composing state.

### 2. Keys (connect, through `core/dom/keyboard`)

| Event | Condition | Machine event |
|---|---|---|
| Enter | `submitKey` "enter" and not touch-primary, no Shift/Mod | `SUBMIT { via: "enter" }` + `preventDefault` when the guard passes |
| Mod+Enter | `submitKey` ≠ "none" | `SUBMIT { via: "mod-enter" }` |
| Shift+Enter, other Enter | — | none (native newline) |
| ArrowUp / ArrowDown | `history` given, no modifier, caret at start / end, `aria-expanded` ≠ "true" | `RECALL` |
| Backspace / ArrowLeft at caret start | `input-chips` | `BACKSPACE_EMPTY` / `CHIP.NAVIGATE` |

Every row checks `event.defaultPrevented` first (spec "Composition With Mentions And
Suggestions") and carries `composing` from `describeKey`. Escape is not mapped.

### 3. File intake (`core/dom/file-intake.ts`, new, framework-free)

- `matchesAccept(file, accept)`: the `<input accept>` grammar (MIME, `type/*`, `.ext`,
  case-insensitive, comma list); written once, reused by File Upload.
- `filesFromClipboard(data)`: `data.files`, else `items` of kind `file` (WebKit exposes only
  one of them, lobehub#4098); returns `null` when `text/plain` is non-empty (ai-elements#509).
- `filesFromDrag(e)`: only when `types.includes("Files")`; `isLeavingRoot(e, root)` by
  `relatedTarget` containment.
- `syncFileInput(input, files)`: assigns `input.files` from a `DataTransfer` (feature-checked;
  without it, FormData omits files and `onSubmit` still gets them); `resetFileInput(input)`
  after each pick (ai-elements#254).
- Validation produces `{ accepted, rejected: { file, reason }[] }`; one `FILES.ADD` per
  gesture → one `onAttachmentsChange` and one announcement; rejections → `onReject` + one
  assertive announcement (count form for several).

### 4. Status → attributes and Submit

- `rootProps`/`textareaProps`: `data-state` from the machine state; `data-composing` from
  context; `enterKeyHint` from the effective submit mode; `aria-describedby` = Description +
  CharacterCount + chips summary; `aria-invalid` over the limit.
- `submitProps`: `type` `submit` in `idle`/`composing`, `button` otherwise; `aria-label`
  from `sendLabel`/`stopLabel` unless the consumer gives one; `aria-disabled` when not
  submittable in `idle` and in `stopped`; native `disabled` only when the Prompt Input is
  disabled; press → `SUBMIT { via: "button" }` (the native submit path, with the button as
  submitter) or `STOP { clickCount: event.detail }`; `preventFocusOnPress` off (focus stays
  where the press put it, on the button).
- `rootProps.onPointerDown`: when the target is the Root itself or a non-interactive
  descendant and no text is selected, focus the Textarea (prompt-kit#55).

### 5. React parts (`packages/react/src/prompt-input`)

`PromptInput.Root` (form + hidden file input + Field host), `Label`, `Description`,
`Textarea` (wires `autosize()` from `core/dom/autosize.ts`), `Submit`, `AttachTrigger`,
`Attachments` (Chips + summary node), `Attachment` (Chip), `AttachmentRemove`,
`CharacterCount`. `render` on each. Dev warnings: no Textarea / two Textareas / no Submit;
placeholder-only name; Attachment outside Attachments.

### 6. Contract

```ts
export const promptInputContract = contract(promptInputMachine, {
  scope: "prompt-input",
  locate: { role: ["textbox", "combobox"], name: true },
  ...inputChipsContract({ scope: "prompt-input" }),
  traits: ["field-associated"],
  announcements: { stopped, sendFailed, attached, rejected, removed },
  actions: { type, fill, compose, submit, stop, attach, paste, drop, recall },
  queries: { value, name, state, attachments, canSubmit, submitName, submitAction,
             characterCount, isOverLimit, isDisabled, isDragging },
  events: {
    SUBMIT: "submit", STOP: "stop", INPUT: "type", "FILES.ADD": "attach",
    "COMPOSITION.START": "compose", "COMPOSITION.END": "compose", RECALL: "recall",
    SETTLED: { skip: "driven by the fixture's onSubmit" }, THREW: { skip: "fixture" },
    FOCUS: { skip: "covered by every action" }, BLUR: { skip: "covered by every action" },
    "$sync:status": { props: (status) => ({ status }) },
    "$sync:value": { props: (value) => ({ value }) },
    "$sync:attachments": { props: (attachments) => ({ attachments }) },
  },
})
```

Fixtures (spec "Model-Based Coverage"): `resolving` (promise resolves on the next
microtask), `rejecting`, `status-driven` (the fixture walks `submitting` → `streaming` →
`idle` on contract steps, so no timers), each recording `onSubmit`/`onStop` calls.

### 7. Theme

`packages/theme/src/prompt-input.css`, tier-3 tokens (decision 0007):
`--rind-prompt-input-gap`, `-padding`, `-radius`, `-bg`, `-border`, `-focus-border`,
`-text`, `-placeholder-text`, `-min-rows`, `-max-block-size` (default `12lh`),
`-drag-outline`, `-over-limit-border`, `-chip-*` (reusing the tags-input chip tokens as
fallbacks), `-count-text`. `field-sizing: content` on the Textarea, `resize: none`,
`min-block-size: calc(var(--rind-prompt-input-min-rows, 1) * 1lh)`; Submit and AttachTrigger
in the button family; `data-dragging` as a dashed outline; remove buttons visible on
`data-focus-visible` and under `(hover: none)`; no transition on height.

## Risks / Trade-offs

- [Clearing at submit time looks "lost" if the request fails] → restore on failure into an
  empty draft, announce the failure assertively; the consumer still has the snapshot.
- [Touch-primary detection misfires on hybrid devices] → `submitKey` overrides; detection is
  `Environment.platform` (injected, tested both ways), not user agent sniffing.
- [`aria-disabled` Submit can be activated by AT] → activation ignored in the machine;
  `button-like-element`'s `focusableWhenDisabled` rules already cover it.
- [One button changing name: some screen readers do not announce a name change of the
  focused button] → the state change is also announced when it matters (stop, failure); the
  reply is announced by Streaming Message.
- [`DataTransfer` assignment to `input.files`] → feature-detected; the callback path does not
  depend on it.
- [Double-click detection by `event.detail`] → `detail` is 0 for keyboard and AT clicks
  (bare `click`), so keyboard and virtual stops always work.

## Requests to other changes

1. **`input-chips`** (archived, `openspec/specs/input-chips`): allow the Chips beside a bare
   textarea in the host Root — APPLIED as a delta in this change
   (`specs/input-chips/spec.md`, MODIFIED "Chips Container And Names"), task A.1.
2. **Future `add-mentions`**: plug in through the Textarea's `onKeyDown` with
   `preventDefault`, set the combobox ARIA on the Textarea, and insert through
   `api.insertText`; Prompt Input needs no change for it. Caret coordinates: the mirror
   element of native-platform §12.
3. **Future `add-suggestions`**: buttons outside the Textarea calling `api.setValue` /
   `api.submit`; the guard and announcements apply unchanged.
4. **Future File Upload**: reuse `core/dom/file-intake.ts` (accept matcher, drop and
   clipboard extraction) instead of a second implementation.

## Migration Plan

New API. AI Elements: `PromptInput` → `PromptInput.Root` (`accept`, `multiple`, `maxFiles`,
`maxFileSize` same; `onError({code})` → `onReject(rejections)`; `onSubmit({text, files})` →
`onSubmit({text, attachments})`), `PromptInputTextarea` → `Textarea`, `PromptInputSubmit
status onStop` → `Submit` with `status`/`onStop` on Root, `globalDrop` → not provided (drop on
the Root; a page-wide drop is consumer code calling `api` with files). assistant-ui:
`ComposerPrimitive.Root/Input/Send/Cancel/AddAttachment/Attachments/AttachmentDropzone` →
`Root/Textarea/Submit/Submit/AttachTrigger/Attachments/Root`; `submitMode` →
`submitKey` (`"ctrlEnter"` → `"mod+enter"`); `cancelOnEscape` has no equivalent.
</content>
</invoke>
