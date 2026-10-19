# Streaming Message — research

One AI response that arrives in chunks: the text grows while the model writes, then the
response is complete, cancelled or failed. The hard part is not drawing text but
everything around it: pacing the reveal so bursty chunks read smoothly, telling
assistive technology what is happening without reading every chunk, keeping the DOM
cheap while it grows, and giving the consumer a clean seam for their own markdown
renderer.

None of the nine headless libraries ships it. The AI-UI kits do, all as styled
React components bound to their own chat runtime.

Sources read (October 2026): Streamdown (`vercel/streamdown`, `packages/streamdown`:
`index.tsx`, `lib/animate.ts`, `lib/parse-blocks.tsx`), Vercel AI Elements
(`packages/elements/src/message.tsx`), assistant-ui (`packages/react/src/utils/smooth/
useSmooth.ts`, `primitives/messagePart/MessagePartText.tsx`), prompt-kit
(`components/prompt-kit/response-stream.tsx`), the issue trackers of all four, Reado
(`src/components/molecules/Announcer.tsx`), and the articles listed under
Accessibility. rind-ui already has `core/a11y/stream.ts` (`streamAnnouncement`).

## Pattern

There is no APG pattern. The pieces it borrows:

- **Live regions** (ARIA 1.2 §6.7): `aria-live`, `aria-atomic`, `aria-busy`. `aria-busy`
  lets a user agent hold back announcements of a region while it changes; holding is
  optional in the spec, so support varies.
- **`role="log"`** belongs on the thread (Message Thread), not on one message. It implies
  `aria-live="polite"`, which is exactly what makes a streamed body read in fragments.
- **WCAG 4.1.3 Status Messages**: the start, end, cancellation and failure of a response
  are status messages and must be announced without moving focus.
- **WCAG 2.2.2 Pause, Stop, Hide** does not apply to the text itself (it stops when the
  response ends) but does apply to a blinking caret that runs longer than 5 s: it must
  stop when the response ends, and under reduced motion it must not blink.

## How the others built it

### Streamdown (Vercel; used by AI Elements' `MessageResponse`)

- A markdown renderer, not a message: `<Streamdown mode="streaming" isAnimating>`.
- Splits the markdown into top-level blocks (`parseMarkdownIntoBlocks`) and renders each
  in a `memo`ised `Block` compared by content, so settled blocks do not re-parse while the
  last one grows. This is the main performance idea and it works only when the
  splitting is stable.
- Repairs incomplete markdown before parsing (`remend`: unclosed `**`, backticks, links,
  images, math, fences) so the half-written syntax does not flash as literal characters.
  Incomplete links get a sentinel `streamdown:incomplete-link` URL.
- Optional word-fade animation: a rehype plugin wraps new words in spans with staggered
  delays on a shared timeline (`MAX_ANIMATION_BACKLOG_MS = 320`), committed in a layout
  effect.
- A caret: a string appended to the last block (`" ▋"`), only while `isAnimating`.
- Callbacks when `isAnimating` turns on and off.
- No `aria-busy`, no live region, no announcement. `data-*` and `aria-*` props were not
  even forwarded to the root until #675.

### Vercel AI Elements (`Message`, `MessageContent`, `MessageResponse`)

- `Message` is a styled `div` with an `is-user` / `is-assistant` class from the AI SDK
  `UIMessage["role"]`; `MessageResponse` is Streamdown with the code, math, mermaid and
  CJK plugins. No streaming state of its own, no accessibility handling beyond named
  icon buttons (branch navigation, "Previous branch" / "Next branch").

### assistant-ui (`MessagePartPrimitive.Text`, `useSmooth`)

- The text part reads `{ text, status }` from the runtime, where `status.type` is
  `running`, `complete`, `incomplete` (cancelled, length, error) or `requires-action`.
- **Smoothing** (`useSmooth`, on by default): a `requestAnimationFrame` animator reveals
  the target text character by character so bursty chunks read evenly. Its rate drains
  the backlog in `drainMs` (250) with at most `maxCharIntervalMs` (5) between characters,
  optionally capped per frame and with commits throttled (`minCommitMs`) so the markdown
  re-parse downstream does not run every frame.
- While the reveal lags behind, the part reports `running` even if the stream is
  complete, so the caret and "busy" state last until the text is actually visible.
- If the new text does not start with what is displayed (an edit, a regenerate, a
  preprocessing step that rewrote earlier text), the reveal restarts.
- **Reduced motion** disables smoothing: the full text is committed at once.
- No `aria-busy` on the part; the "Thread" has its own viewport and auto-scroll logic.

### prompt-kit (`ResponseStream`)

- Takes a string or an `AsyncIterable<string>` and reveals it in `typewriter` mode
  (characters per tick from a 1–100 `speed`) or `fade` mode (segments wrapped in spans
  with a fade duration and per-segment delay), with `onComplete`.
- No accessibility handling and no reduced-motion handling; `fade` mode puts every
  segment in its own span.

### Reado

- One app-wide pair of live regions (polite, assertive); a repeated message is made new
  by re-keying the span. No chat streaming UI; the terminal deliberately paints nothing
  per chunk.

### Not shipped

Radix, React Aria, Ark / Zag, Base UI, Headless UI, Ariakit, Kobalte, Reka, Melt.

## Accessibility

What the tested sources agree on (azukiazusa, "accessible streaming chat UI"; the
Chainlit PR #3014; the Claude NVDA report; Atlassian ROVO-978):

- **Never make the growing body a live region.** A body inside `aria-live` (or inside a
  `role="log"`, which implies it) is read in fragments, chunk after chunk; NVDA with
  Firefox reads it token by token (OpenClaw report). Silencing the speech does not help:
  the next chunk starts it again.
- **Announce the lifecycle, separately and politely**: "Generating a response" on start,
  "Response complete" on completion, "Response cancelled", and a failure text. ChatGPT
  says "Thinking"; Claude says "Claude is responding" / "Claude finished the response".
  Failures stay polite: a failed reply rarely needs to interrupt.
- **Optionally read the response once**, complete, after it ends. rind-ui's
  `streamAnnouncement` already does this ("completion" mode) and a sentence mode for
  long answers. Users differ: some want the text read, most want only the status and
  then navigate to the message themselves. This must be the consumer's choice.
- **`aria-busy="true"` on the body while it streams** is the cheap guard: VoiceOver with
  Chrome holds announcements of the busy subtree until it clears (shadcn's example). It
  is optional in the spec, so it complements the rules above and never replaces them.
- **Never move focus** on start or completion; focus stays in the prompt.
- **Identity**: who wrote the message must be in text ("You said", "Assistant said"),
  not only by side or colour. That is the Message Thread's concern, but the message must
  accept a label.
- **Repeated messages**: the same text twice in a row is not announced again unless the
  region is re-keyed or cleared first. rind-ui's announcer already handles keys and
  repeats.
- **Caret**: decorative, `aria-hidden`; its blink stops when the response ends and does
  not run under reduced motion.

## Bug history

Streamdown:
- #482 (closed) the word animation revealed several sections at once instead of one
  after another; fixed with a shared timeline. #570 (closed) animation spans were never
  removed from settled text, so the DOM kept thousands of spans. #594, #669 (open: CJK
  paragraphs animate only their first batch).
- #550 (closed) block updates deferred with `useTransition` were starved by sibling
  urgent updates: the markdown froze at its first parse.
- #328 (closed) text got stuck with large, fast responses.
- #402, #186 (closed) code highlighting flickered while streaming (async Shiki).
  #195, #357 (closed) large or tricky code blocks froze the tab. #473 (open) fenced code
  does not render incrementally.
- #313, #539 (open), #616 (open), #652 (open) incomplete-markdown repair: half-written
  markers flash, and the repair itself can delete text (`\sum_{j<k}` removes the rest of
  the message).
- #320 (closed) content briefly unmounted during hydration.
- #556, #485, #506, #643 (closed) accessibility of the toolbar buttons (title-only, no
  copy announcement, hard-coded English labels). #675 (closed) `aria-*` props were not
  forwarded.

assistant-ui:
- #6726 (closed) every streamed token parsed the message twice. #7511 (closed) a
  preprocessing step restarted the smooth reveal from the first character mid-message.
  #7976 (closed) streaming repair kept running on finished messages.
- #6315 (closed) the viewport jumped at the end of a stream in Safari; #5970, #8211,
  #8220 (closed) auto-scroll lost or regained the bottom wrongly (Message Thread
  material).

AI Elements:
- #439 (open) Enter submitted the form during streaming because the submit button was
  not found. #393 (closed) a Streamdown release broke the Reasoning component.
  #496 (open) Reasoning switched from uncontrolled to controlled when a duration arrived
  at the end of streaming.

Screen readers:
- Claude NVDA report: no announcement when a response starts or ends.
- ROVO-978: dynamically updating content not announced.
- OpenClaw: NVDA + Firefox read a `role="log"` body token by token.

## Known pitfalls

- A reveal that lags the stream must keep the message "busy" until it catches up, or the
  completion is announced before the text is visible (assistant-ui reports `running`).
- A reveal must restart, not glitch, when the text stops being an extension of what is
  shown (edit, regenerate, rewrite).
- Committing every animation frame re-parses markdown every frame; throttle the commit,
  not the reveal.
- A caret appended inside the markdown string changes the parse (Streamdown adds it to
  the last block); render it as its own element after the content.
- Cancel and error must stop the reveal at what has been received, not at what has been
  revealed: the user should see everything that arrived.
- Hydration: the server render shows the text as it is; the reveal never starts from an
  empty string on a message that was already complete.
- Timers: every pacing step goes through the injected Scheduler so tests run on a
  virtual clock.

## Testing notes

- Machine in Node: start, chunks, complete, cancel, error, reset; reveal pacing with a
  virtual clock (backlog drained in `drainMs`, never faster than one frame per step).
- Announcements with the recording announcer: one start, one end, nothing per chunk in
  status mode; the full text once in completion mode; sentences in sentence mode.
- DOM: `aria-busy` exactly while streaming or revealing, caret present and `aria-hidden`
  only then, the consumer's renderer receives the displayed text, reduced motion shows
  the full text at once.
- Browser: no per-chunk speech is observable only by hand; the model test checks that the
  body is never inside a live region (an invariant over the DOM).

## Decisions

1. **Headless, no markdown.** The component owns state, pacing, the caret, `aria-busy`
   and announcements. The content is rendered by the consumer from the displayed text
   (a render function), so Streamdown, react-markdown or plain text all plug in. No
   runtime dependency (CLAUDE.md).
2. **Text and status come from the consumer** (`text`, `status`: `pending`, `streaming`,
   `complete`, `cancelled`, `error`), because every chat runtime already has them. The
   component never fetches.
3. **Smoothing is a pure pacing function in core** (assistant-ui's drain model:
   `drainMs`, `maxCharIntervalMs`, `maxCharsPerFrame`, `minCommitMs`), driven through the
   Scheduler. Off under reduced motion; off for a message that mounts already complete.
4. **Announcements default to the lifecycle** (start, complete, cancelled, error; polite)
   through the Environment's announcer, keyed per message. `announce="text"` reads the
   complete text once (`streamAnnouncement` completion mode), `"sentences"` reads it in
   sentences, `"none"` leaves it to the thread.
5. **`aria-busy` on the content** while streaming or revealing; the body is never a live
   region.
6. **The caret is a part** (`Caret`), `aria-hidden`, rendered only while busy.

## Open questions

- Should the lifecycle announcement live in the message or in the thread? A thread with
  one active message is the common case; the message owns it, and a thread can pass
  `announce="none"` to take it over (decided in Message Thread's research).
- Whether `aria-busy` helps or hurts NVDA and JAWS: to test by hand in tier-1 AT passes.
