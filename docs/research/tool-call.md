# Tool Call — research

Status: done · Wave: AI

A Tool Call is how an AI chat shows that the model called a tool: a header with the tool's name
and a **status** (pending, running, done, error), a collapsible body with the **input** the model
sent and the **output** or error that came back, and, for sensitive tools, an **approval**: the
run is paused until a human presses Approve or Deny. The first part is a status disclosure, much
like Reasoning. The second part is the hard one: it is a decision the user must notice, answer
once, and not lose their place over, while the transcript keeps streaming around it. There is
no model and no tool runtime inside: the consumer (AI SDK, assistant-ui runtime, CopilotKit,
anything) tells the component the status and receives the decision. None of the nine headless
libraries ships it. The AI kits do. This note records how they built it, the bugs on their
trackers, and the decisions for `add-tool-call`.

Builds on [reasoning.md](reasoning.md) (the lifecycle disclosure: `thinking | done`, auto-open
and auto-close, duration) and [collapsible.md](collapsible.md) (button + region,
`aria-expanded`, `aria-controls`), [alert-dialog.md](alert-dialog.md) and
[dialog.md](dialog.md) (the modal alternative and initial focus), [alert.md](alert.md),
[code-block.md](code-block.md) (JSON input and output), [timer.md](timer.md) (an injected
Clock for elapsed time), [message-thread.md](message-thread.md) (a tool call is part of an
assistant message; expanding must not be fought by follow-the-bottom),
[streaming-message.md](streaming-message.md), [message-actions.md](message-actions.md), and the
cross-cutting notes [accessibility.md](accessibility.md) §1.5, §7,
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes A, D, H.

Sources read (GitHub API and `gh`, 2026-10-26):

| Library | Files |
|---|---|
| Vercel AI Elements | `vercel/ai-elements` `packages/elements/src/tool.tsx` (173 lines: `Tool`, `ToolHeader`, `ToolContent`, `ToolInput`, `ToolOutput`), `packages/elements/src/confirmation.tsx` (169 lines: `Confirmation`, `ConfirmationTitle`, `ConfirmationRequest`, `ConfirmationAccepted`, `ConfirmationRejected`, `ConfirmationActions`, `ConfirmationAction`) |
| assistant-ui | `packages/ui/src/components/react/assistant-ui/elements/tool-fallback.aui.tsx` (grepped for `aria`, `role`, `focus`, `requires-action`, `data-`, and read the head and the approval receipt focus section), `.../elements/approval-card.tsx` (read the card and its `role="status"` receipt), `packages/core/src/runtime/utils/resolveToolApprovalResponse.ts` (head) |
| CopilotKit | `packages/react-core/src/v2/hooks/use-human-in-the-loop.tsx` (whole file: `respond`, abort, unmount) |
| prompt-kit | `components/prompt-kit/tool.tsx` (grepped: `Collapsible`, `state`, `useState`, `output-error`) |
| Open WebUI | issues only (tool approval mode) |
| Trackers | `vercel/ai-elements`, `assistant-ui/assistant-ui`, `CopilotKit/CopilotKit`, `ibelick/prompt-kit`, `open-webui/open-webui` |
| Platform | WAI-ARIA APG Alert and Message Dialog (Modal), Disclosure; WAI-ARIA 1.2 `role="status"`, `role="alert"`; AI SDK tool part states as AI Elements' `statusLabels` use them |

Radix, React Aria, Ark/Zag, Base UI, Headless UI, Ariakit, Reka UI, Bits UI and Kobalte ship no
Tool Call. LibreChat's tracker could not be searched through the GitHub API in this session
(search rejected the repository) and is not read; Chainlit's "ask user" actions were searched
by title only and no accessibility issue was found.

## Pattern

- WAI-ARIA APG **Disclosure** for the tool call body: a button with `aria-expanded`
  controlling a region. rind-ui's Collapsible already is that; the Reasoning decision keeps
  its own machine because the lifecycle adds states.
- **Status** is state in text. Icons and badges are decoration: AI Elements puts the status
  in the badge text ("Awaiting Approval", "Running", "Completed", "Denied", "Error"); the
  assistant-ui trigger once labelled every call "Used tool: name" and carried the state only
  in an icon that lucide renders `aria-hidden` (assistant-ui #7957).
- **Approval** is a human decision gate. Candidates:
  - APG **Alert** (`role="alert"`, assertive): interrupts the user. AI Elements wraps the
    approval in shadcn's `Alert`, whose source sets `role="alert"` on the container; every
    approval therefore speaks assertively when it mounts.
  - APG **Alert and Message Dialog (Modal)** (`role="alertdialog"`): "interrupts the user's
    workflow to communicate an important message and acquire a response"; modal, labelled,
    described, with `aria-modal="true"` and initial focus on a button (alert-dialog.md:
    least destructive action). Right for an irreversible tool (delete, pay, send); too heavy
    for an inline "run this search?" repeated 20 times in a transcript.
  - **Inline group** (`role="group"` named by the tool and described by its summary) plus a
    **status message** (`role="status"`) when it is answered. assistant-ui's approval card
    does this: `role="group"`, `aria-labelledby` the title, `aria-describedby` the
    description, and a receipt `div role="status" tabindex="-1"`.
- **Keyboard**: Tab to the group, Enter and Space on each button. No Escape (it belongs to the
  enclosing layer, prompt-input.md) and no global shortcut to approve.
- WCAG 4.1.3 Status Messages (the request, the result), 3.2.2 On Input (pressing Approve
  runs a tool: the button must say what it will do), 2.4.3 Focus Order, 3.3.4 Error
  Prevention (legal, financial, data: reversible, checked or confirmed).

## How the others built it

| | AI Elements | assistant-ui | CopilotKit | prompt-kit |
|---|---|---|---|---|
| Status source | AI SDK `ToolUIPart["state"]`: `input-streaming`, `input-available`, `approval-requested`, `approval-responded`, `output-available`, `output-denied`, `output-error` | `status.type`: `running`, `complete`, `incomplete`, `requires-action` (+ `reason`) | `ToolCallStatus`: `InProgress`, `Executing`, `Complete` | AI SDK states (same as AI Elements) |
| Body | shadcn `Collapsible`, `Tool` / `ToolHeader` (trigger) / `ToolContent` / `ToolInput` / `ToolOutput` | `ToolFallbackRoot` over a Collapsible, `Trigger`, `Content`, `Args`, `Result`, `Error`, `Duration` | none (render function) | `Collapsible` with `useState(defaultOpen)` |
| Approval | separate `Confirmation` with `Request` / `Accepted` / `Rejected` / `Actions` / `Action` | built into the fallback (Allow / Deny, options, free text) and `ApprovalCard` | `respond` prop of the render function, live only while `Executing` | none |
| Approval a11y | `Alert` (`role="alert"`); nothing about focus | `role="group"` named; receipt `role="status"` and focus moved to it | consumer | n/a |
| Double press | consumer | disabled during submission (see bugs) | `respond` resolves once; a second call is a no-op (ref cleared) | n/a |

### Vercel AI Elements (`Tool`, `Confirmation`)

- `Tool` is a `Collapsible` with a border; `ToolHeader` is the trigger with the name
  (`title ?? derivedName`), a badge from `getStatusBadge(state)` (icon plus text) and a chevron
  rotated by `group-data-[state=open]`. `Tool` passes its props to the Collapsible (so it is closed unless the consumer sets
  `defaultOpen`) and nothing opens it for a pending approval: an approval placed inside a
  closed `Tool` is hidden. `ToolInput` renders `JSON.stringify(input)` in a
  CodeBlock; `ToolOutput` returns `null` when `!(output || errorText)` and shows "Error" or
  "Result" as an `h4`.
- `Confirmation` takes `approval` (`{ id, approved?, reason? }`) and `state`, and renders
  `null` when `!approval` or the state is `input-streaming` / `input-available`.
  `ConfirmationRequest` and `ConfirmationActions` render only in `approval-requested`;
  `ConfirmationAccepted` / `Rejected` render in `approval-responded`, `output-denied` and
  `output-available`. `ConfirmationAction` is a Button with `type="button"`; the component has no pending
  state, no guard against a second press and no focus handling of its own.
- The approval type is a hand copy of the SDK's and drifted
  ([#484](https://github.com/vercel/ai-elements/issues/484)).

### assistant-ui (`ToolFallback`, `ApprovalCard`)

- The trigger carries a status icon and, after #7957, text for running, waiting, failed and
  cancelled. `ToolFallbackDuration` shows an elapsed time from `useToolCallElapsed()`
  (`"<1s"`, `"4.2s"`, `"1m 12s"`), `tabular-nums`, not live.
- Approval: `role="group"` with `aria-label={question.prompt}` per question; option buttons
  use `aria-pressed`; on submit the controls are disabled and replaced by a receipt
  (`running`, `denied`, `done`) that is `role="status"` and `tabIndex={-1}`.
  `useReceiptFocus` records, when the pending group detaches, whether it still contained the
  active element, and the matching receipt focuses itself with `focus({ preventScroll:
  true })` ([#8704](https://github.com/assistant-ui/assistant-ui/pull/8704): "Focus the stable
  pending group before submission or confirmation removes the focused control"). Historical
  receipts and deliberate departures keep their focus.
- `resolveToolApprovalResponse` validates answers before responding (a question must exist,
  ids must be unique) and maps option kinds `allow-once` / `allow-always` to approved and
  `reject-once` / `reject-always` to denied.
- Interrupt and `addResult` answers render no receipt, so focus dropped to `<body>`
  ([#8994](https://github.com/assistant-ui/assistant-ui/issues/8994)).

### CopilotKit (`useHumanInTheLoop`, `renderAndWaitForResponse`)

- The render function receives `respond` **only while `Executing`**; in `InProgress` and
  `Complete` it is `undefined`: the button cannot answer outside the waiting state, by type.
- `respond(result)` resolves the pending promise through a ref and sets the ref to `null`: a
  second call does nothing. An `AbortSignal` rejects the promise with "Human-in-the-loop
  interaction aborted" and detaches its listener whichever settles first.
- The renderer is removed on unmount ("they can't respond to user interactions anymore"), in a
  layout effect to match registration order.
- A closing exhaustiveness check (`const exhaustiveCheck: never = props`) forces any new
  status to get a branch.

### prompt-kit and Open WebUI

- prompt-kit `Tool`: a `Collapsible` with `useState(defaultOpen)` over the AI SDK states; an
  `output-error` branch and an `input-streaming` placeholder.
- Open WebUI has an "Ask for approval" mode for tools; the bug history below shows a stuck
  state for repeated same-name calls.

### Not shipped

Chainlit shows steps (nested) and ask-user actions; no reusable approval component.

## Bug history

Search: the trackers above for "tool", "approval", "human in the loop", "interrupt",
"confirmation", "focus" (open and closed), title lists per search; the issues below read
(entries marked "title only" were not opened).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| assistant-ui | [#8704](https://github.com/assistant-ui/assistant-ui/pull/8704) (PR) | focus falls to `<body>` when an approval control is disabled during submission and replaced by its receipt | the focused control unmounts | merged | focus moves to a stable target, the receipt, only when it was inside the group |
| assistant-ui | [#8994](https://github.com/assistant-ui/assistant-ui/issues/8994) | after answering an interrupt or `addResult`, focus drops to the page | no receipt on those paths | closed | every way out of `awaiting` has a focus target (the Header trigger is the fallback) |
| assistant-ui | [#7957](https://github.com/assistant-ui/assistant-ui/issues/7957) | a running, waiting or failed call reads as "Used tool: name" | state only in an `aria-hidden` icon | closed | the status is text in the trigger's name |
| assistant-ui | [#6094](https://github.com/assistant-ui/assistant-ui/issues/6094) | the default fallback shows Allow / Deny on a `requires-action` part with no approval; `respond()` falls through to `addResult("Approved by user")`, fabricating a result | a working-looking button with nothing behind it | closed | no `onApprove` / `onDeny` handler means the buttons are not rendered; the component never invents a result |
| assistant-ui | [#6724](https://github.com/assistant-ui/assistant-ui/issues/6724) (title only) | the interrupt seam renders a question as a fabricated allow / deny | same family | closed | an approval is a request with `options`; the generic Approve / Deny is one case |
| assistant-ui | [#7960](https://github.com/assistant-ui/assistant-ui/issues/7960) | a read-only thread hands live mutation callbacks to every tool UI; answering throws | no flag says the thread cannot answer | closed (capability flag) | `readOnly` is a prop: the group shows the pending decision as text, the buttons are absent |
| assistant-ui | [#8413](https://github.com/assistant-ui/assistant-ui/issues/8413), [#8348](https://github.com/assistant-ui/assistant-ui/issues/8348) (excerpt read) | answering an approval on a message that later turns follow is a silent no-op; the kit keeps showing Allow and Deny | the SDK rewrites only the last message | closed | the consumer's `onDecision` may reject: the machine goes to `error` (visible, announced) and re-enables the buttons; it never assumes success |
| assistant-ui | [#7645](https://github.com/assistant-ui/assistant-ui/issues/7645) (excerpt read) | a host answer given while the message still streams is overwritten by the next chunk | the SDK republishes its own copy; the part reads `approval-requested` again | closed | status is a prop that can move backwards; an `awaiting` re-entry starts a new attempt (the machine resets `submitting`) |
| assistant-ui | [#8560](https://github.com/assistant-ui/assistant-ui/issues/8560) (excerpt read) | a pending approval is lost on reload | the history adapter skipped `requires-action` messages | closed | a tool call can mount already `awaiting`: it must render and be answerable without having seen a transition |
| assistant-ui | [#7655](https://github.com/assistant-ui/assistant-ui/issues/7655), [#7814](https://github.com/assistant-ui/assistant-ui/issues/7814) (title only) | approval description and error reason collapse line breaks | whitespace handling | closed | `Description` keeps `white-space: pre-wrap` in the theme |
| assistant-ui | [#8946](https://github.com/assistant-ui/assistant-ui/pull/8946), [#8952](https://github.com/assistant-ui/assistant-ui/issues/8952) | the thread kept following the bottom after a reader expanded a disclosure in a message, pushing expanded content away | follow ignores user intent | merged | the thread pauses on a click of an `aria-expanded="false"` control (Message Thread); the Tool Call's Trigger has exactly that attribute |
| assistant-ui | [#8223](https://github.com/assistant-ui/assistant-ui/issues/8223) | focus taken from another text field when a run starts elsewhere | auto focus on every run start | closed | the approval does not take focus unasked: `focusOnRequest` is explicit and off by default |
| AI Elements | [#490](https://github.com/vercel/ai-elements/issues/490) | `ToolInput` crashes the whole tree while a tool input is streaming | `input` is `undefined`; `JSON.stringify(undefined)` is `undefined`, then `code.split` | open | `Input` renders nothing for `undefined` and a placeholder while `pending`; no throwing in a part |
| AI Elements | [#399](https://github.com/vercel/ai-elements/issues/399) | an empty-string tool result is hidden | `if (!(output \|\| errorText))` is falsy for `""` | open | presence is `output !== undefined`, not truthiness; an empty result renders "No output" |
| AI Elements | [#297](https://github.com/vercel/ai-elements/issues/297) | chevron does not rotate with the open state | `group-data-[state=open]` on an element without the group | closed | the open state is `data-state` on every part |
| AI Elements | [#484](https://github.com/vercel/ai-elements/issues/484) | the approval type drifted from the SDK's | hand copy | open | no SDK types in the API: our own `status` union |
| AI Elements | `confirmation.tsx` (source, no issue) | each approval mounts an assertive `Alert`; no pending state; second press not guarded | design | open (by design) | polite announcement by default; a pending state; double press ignored |
| CopilotKit | [#5554](https://github.com/CopilotKit/CopilotKit/issues/5554) | the user abandons the form (closes the tab); the agent receives an empty result and continues | no timeout, no error propagated | closed | abandonment is not an answer: unmount or abort reports `onDecision` never, and the machine goes to `expired` |
| CopilotKit | [#7407](https://github.com/CopilotKit/CopilotKit/issues/7407) | an expanded tool row disappears while the user reads it (rolling window of recent rows) | background progress wins over a user-opened row | open | a user-opened Tool Call is never unmounted by the consumer's list rules; the component exposes `data-user-opened` so the consumer can keep it |
| CopilotKit | [#7695](https://github.com/CopilotKit/CopilotKit/issues/7695) | StrictMode wipes hook-registered renderers: HITL renders nothing in dev | registration effect order across mount, unmount, mount | closed | no registry: parts get props; nothing the component needs lives in a mount-order effect |
| CopilotKit | [#2927](https://github.com/CopilotKit/CopilotKit/issues/2927) | the intermediate in-progress state is not rendered, overwritten almost at once | overwritten almost at once, per the report | closed | `pending` and `running` render for at least a frame and are queryable states |
| Open WebUI | [#29293](https://github.com/open-webui/open-webui/issues/29293) | in "Ask for approval" mode repeated same-name tool calls in one batch stay "Executing..." forever and the state is persisted | per the title, same-name calls in one batch; root cause not read in depth | closed | identity is the call's `id`, never its name; two same-name calls are two components |
| prompt-kit | [#59](https://github.com/ibelick/prompt-kit/issues/59) (title: "Tool calling UI") | feature request "Tool calling UI" (title only) | n/a | closed | n/a |

## Accessibility decisions

- **Header** is the disclosure trigger (a real `button`, `aria-expanded`, `aria-controls`
  only while the body is rendered, like Reasoning). Its accessible name contains the tool
  name **and the status in words** ("search_web, running", "delete_file, waiting for
  approval", "search_web, failed"). The status icon is `aria-hidden`; the badge text is
  part of the name, not a second reading.
- **No live region on the header or the body.** A status that changes while the user is
  elsewhere is not announced by the header. Announced, once and politely, through the
  Announcer: entering `awaiting` ("Approval needed: delete_file"), entering `error`
  ("search_web failed"). Entering `done` is silent: tool results are not news in a chat that
  streams text. `announce: "off" | "polite" | "assertive"` (default `"polite"`).
- **Auto-open on `awaiting`**: a pending approval must be visible. The body opens when the
  status moves into `awaiting` (or mounts `awaiting`), unless the user has toggled it
  closed. Reasoning's rule for auto-close does **not** apply: an approval is never closed
  for the user. A user-opened body stays open when the status changes.
- **Approval group**: `role="group"`, `aria-labelledby` the Title, `aria-describedby` the
  Description (what the tool will do, with the arguments in readable form), buttons named by
  what they do ("Allow delete_file", not "Yes"). A destructive variant is `data-risk="high"`
  and puts the least destructive button first in DOM order; a modal `AlertDialog` is the
  consumer's choice when the action is irreversible, and `Approve` / `Deny` work inside it.
- **Focus on request**: `focusOnRequest: "none" | "group" | "approve" | "deny"`, default
  `"none"` (assistant-ui #8223: moving focus on an external event steals it from the
  prompt). The approval is announced and reachable by Tab / the thread's keys; a consumer
  who runs a blocking agent may choose `"group"` (focus on the group, `tabindex="-1"`).
- **One answer.** First press moves `awaiting` to `submitting`: both buttons are
  `aria-disabled` (not `disabled`, so focus stays on the pressed one), `aria-busy` on the
  group, further presses ignored (CopilotKit's `respond` is a no-op the second time; AI
  Elements has no guard). The consumer's `onDecision` may be async.
- **Settled**: the group is replaced by (or turns into) a **receipt** `role="status"`
  `tabindex="-1"` with text "Approved" / "Denied" and the reason. Focus moves to the receipt
  **only if focus was inside the group** when it settled (assistant-ui #8704), with
  `preventScroll`; if focus was elsewhere nothing moves. Every settle path has a target: if
  there is no receipt, focus goes to the Header trigger (assistant-ui #8994).
- **Failure** of `onDecision` (rejection, or the consumer moving the status back to
  `awaiting`): `error` text in the group via the Announcer, buttons re-enabled, focus on the
  button that was pressed.
- **Expired and read-only**: when the run is aborted or the thread cannot answer
  (CopilotKit #5554, assistant-ui #7960) the group shows "Approval no longer needed" or the
  decision as text and renders no buttons.
- **Input and output**: `Input` and `Output` are `region`s only if the consumer names them;
  by default plain content with a visible heading (`h4` is the consumer's level, from the
  Message Thread). JSON is shown in a CodeBlock (focusable when it scrolls). An empty output
  renders "No output".
- **Elapsed time** (`Duration`) is static text updated on the injected Clock while running at
  most once a second, `aria-hidden` while running (a changing number is noise) and read once
  in the header name when done ("search_web, done in 4.2 seconds").
- **Reduced motion**: the running indicator does not spin; a static glyph.
- **Forced colors and no colour-only status**: the status is text.

## Testing notes

- Machine in Node: status transitions including backwards (`awaiting` after `done`), mount
  in each status, auto-open, user toggle wins, `awaiting -> submitting -> settled | error`,
  second press ignored, abandonment to `expired`, read-only, duration on a virtual Clock.
- Model-based: every event in every state; invariant "at most one `onDecision` per attempt".
- Browser (three engines): Tab and Space on the Header; focus on the pressed button during
  `submitting`; focus on the receipt after a keyboard answer; focus unchanged after a pointer
  answer outside the group; no `<body>` focus after any path (answer, failure, abort,
  unmount of the consumer's list); announcements recorded (one on `awaiting`, none on `done`);
  axe on every status and the approval variants; zoom 200% and forced colors.
- Streaming: input appearing (`undefined` to a partial object to a full one) never throws and
  never resets the user's open state; the same tool call re-rendered on every chunk keeps
  `submitting`.

## Decisions for `add-tool-call`

- **Two layers in one component**: the Tool Call (status disclosure) and its **Approval** (a
  nested part group); the Approval can be used without the body (a compact inline request).
  Not a separate `Confirmation` component (AI Elements): the approval belongs to a call, has
  its id, status and lifecycle, and its parts share the machine.
- **Parts**: `Root`, `Header` (the trigger), `Name`, `Status` (text, in the name), `Duration`,
  `Content`, `Input`, `Output`, `Error`, `Approval` (`role="group"`), `ApprovalTitle`,
  `ApprovalDescription`, `Approve`, `Deny`, `Receipt` (`role="status"`). Only `Root` and
  `Header` are required; `Approval` and its parts are optional.
- **Machine** `tool-call`: `status` is a bound prop (`pending | running | awaiting | done |
  error | denied | cancelled`), not a state the component can reach by itself: the consumer
  maps its runtime (AI SDK: `input-streaming` to `pending`, `input-available` to `running`,
  `approval-requested` to `awaiting`, `approval-responded` to `running`, `output-available`
  to `done`, `output-error` to `error`, `output-denied` to `denied`; assistant-ui `running`,
  `complete`, `incomplete`, `requires-action`). Machine states for the approval attempt:
  `idle | awaiting | submitting | settled | failed | expired`. Disclosure: `closed | open`
  (controllable, as Collapsible and Reasoning).
- **Events**: `STATUS.CHANGE`, `TOGGLE { modality }`, `APPROVE`, `DENY { reason? }`,
  `DECISION.DONE`, `DECISION.FAILED { error }`, `ABORT`, `READONLY.CHANGE`, `FOCUS_IN`,
  `FOCUS_OUT`. `APPROVE` / `DENY` are ignored unless `awaiting`.
- **Props**: `id` (the call's identity; never the name), `status`, `name`, `open`,
  `defaultOpen`, `onOpenChange`, `onDecision({ id, approved, reason? }): void | Promise<void>`
  (absent means no buttons), `readOnly`, `announce`, `focusOnRequest`, `risk: "normal" |
  "high"`, `messages`, `lang`, `duration?: number` (seconds, else measured on the Clock
  between live transitions, never on mount, as Reasoning).
- **`data-*`**: `data-scope="tool-call"`; every part `data-state` (the call's status),
  `data-open`; `Header` `data-user-opened`; `Approval` `data-state` (`awaiting | submitting |
  settled | failed | expired`), `data-risk`, `data-decision` (`approved | denied`);
  buttons `data-disabled`, `data-pressed`, `data-focus-visible`.
- **Contract**: locate by the Header's name (the tool name), else the only Tool Call in the
  target. Actions `open`, `close`, `approve`, `deny(reason?)`, `focusApproval()`. Queries
  `status`, `isOpen`, `approvalState`, `input`, `output`, `decision`, `duration`,
  `announcements`, `focusedPart`. Env: `setStatus(status)` (drives the prop in tests).
- **Reuse**: Collapsible's presence and region logic and Reasoning's auto-open rules (one
  shared module, not duplicated), CodeBlock for JSON, the Announcer, the injected Clock,
  Alert Dialog composed by the consumer for modal approval.
- **Deliberately different**: status in words in the header's name (assistant-ui #7957);
  approval part of the call with an attempt lifecycle and a double-press guard (AI Elements
  has none); focus rules from #8704 and #8994 as machine behaviour; focus not taken unasked
  (#8223); identity by id (Open WebUI #29293); no fabricated results (assistant-ui #6094);
  abandonment is `expired`, not an empty answer (CopilotKit #5554); no SDK types (AI Elements
  #484).
- **Non-goals**: running or registering tools; the tool schema and input validation; "always
  allow" and remembered permissions (consumer `options` through extra buttons); forms inside
  the approval (a consumer's `Input` field with `aria-describedby`); nested or parallel tool
  call grouping (a list is Message Thread's); streaming JSON repair; time-outs (the
  consumer sets `expired`).

## Open questions

- **Assertive for high risk**: `risk="high"` could announce assertively like an alert; the
  APG alertdialog is modal. Whether a non-modal assertive announcement is acceptable is a
  tier-1 AT question.
- **A modal variant in the box?** Composition with Alert Dialog covers it; the open point is
  whether `Approve` / `Deny` inside an Alert Dialog should also close it (alert-dialog.md
  notes `Action` always closing is a Radix complaint, #1747).
- **Grouping**: eight parallel tool calls in one message: one disclosure for the group?
  Out of scope; the research found no kit with an accessible pattern for it.
- **`cancelled`** (the user stopped the run) versus `denied`: a status of its own is assumed;
  assistant-ui labels a cancelled call separately ("Cancelled tool: name", #7957).
