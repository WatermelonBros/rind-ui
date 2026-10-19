# Reasoning — research

A model's chain of thought shown beside its answer: a disclosure that opens by itself while
the model is thinking, says so ("Thinking…"), closes when the answer starts, and keeps a
summary ("Thought for 12 seconds") the user can expand. It is a Collapsible with a
streaming lifecycle; the hard parts are the automatic opening and closing (never against
the user, never on an old message, never hiding focus), the duration, and telling
assistive technology without reading the trace.

None of the nine headless libraries ships it. The AI kits do.

Sources read (October 2026): Vercel AI Elements (`packages/elements/src/reasoning.tsx`),
assistant-ui (the `reasoning` element docs, `MessagePrimitive.GroupedParts`), prompt-kit
(`components/prompt-kit/reasoning.tsx`), their issue trackers, and rind-ui's own
Collapsible and Streaming Message research.

## Pattern

APG **Disclosure**: a button with `aria-expanded` and `aria-controls` (only while the
controlled element exists) toggling a region. Nothing more is standard; the lifecycle is
this component's own.

## How the others built it

### Vercel AI Elements (`Reasoning`, `ReasoningTrigger`, `ReasoningContent`)

- A shadcn Collapsible with `isStreaming`, controllable `open` (`defaultOpen` defaults to
  `isStreaming`) and a controllable `duration` in seconds.
- Auto-opens when streaming starts unless `defaultOpen` was explicitly `false`; auto-closes
  `AUTO_CLOSE_DELAY` (1000 ms) after streaming ends, once (`hasAutoClosed`).
- Measures the duration with `Date.now()` between start and end
  (`Math.ceil(… / 1000)`).
- Trigger text from `getThinkingMessage(isStreaming, duration)`: a shimmering
  "Thinking...", then "Thought for N seconds" or "Thought for a few seconds".
- Content renders Streamdown. No `aria-busy`, no announcement.

### assistant-ui (`ReasoningRoot`, `ReasoningTrigger`, `ReasoningContent`)

- Consecutive `reasoning` message parts are grouped into one disclosure
  (`groupPartByType`), so a model that thinks in several bursts shows one trace.
- `streaming` / `active` flags; `aria-busy` on the content while running.
- A static `ReasoningPanel` design renders titled steps on a timeline (Chain of Thought).

### prompt-kit (`Reasoning`)

- Collapsible with `isStreaming`; auto-opens when streaming starts and auto-closes when it
  ends, but only if it opened automatically (`wasAutoOpened`): a user's own open is kept.
- Animates the content height with a ResizeObserver; markdown content.

### Not shipped

Radix, React Aria, Ark / Zag, Base UI, Headless UI, Ariakit, Kobalte, Reka, Melt.

## Accessibility

- **The trace is not announced.** It can be long and is secondary; the lifecycle is:
  "Thinking" when it starts and "Thought for 12 seconds" when it ends, politely, keyed per
  instance (the Streaming Message research: never read chunks, announce status).
- **The trigger says what is happening** in its own text ("Thinking…", "Thought for 12
  seconds"), so a screen-reader user who reaches it hears the state without an
  announcement. Its name changes, which screen readers do not re-read on their own; that is
  why the lifecycle is also announced.
- **`aria-busy`** on the content while the model thinks.
- **Automatic closing never hides focus**: if focus is inside the content (the user is
  reading it with a screen reader's focus mode, or selected a link), the content stays open.
- **The user wins**: once the user toggles it, nothing toggles it automatically again.
- **Reduced motion**: no shimmer and no height animation.
- `aria-controls` only while the content is rendered (AI Elements #505 for Chain of
  Thought).

## Bug history

AI Elements:
- #86 (closed) old messages opened and closed by themselves when shown again (the
  auto-toggle ran on mount).
- #106 (closed) a long thinking response showed several thinking elements; they should
  merge into one.
- #496 (open) passing `duration` once streaming ended switched it from uncontrolled to
  controlled (a React warning).
- #393 (closed) a Streamdown release broke the Reasoning component (a tight coupling to
  the markdown renderer).
- #505 (open) Chain of Thought's `aria-controls` points at an element that is never
  rendered.

assistant-ui:
- #8834 (closed) consecutive reasoning parts were not grouped into one disclosure (Vue kit).
- #8367 (closed) expanding a collapsible during streaming fought the auto-scroll (the thread
  must pause following when content opens above the bottom).
- #8457, #8192 (closed) missing or erased reasoning records in adapters (runtime, not UI).

## Known pitfalls

- Auto-toggling on mount reopens old messages (#86): only a live transition from thinking
  to done may close it.
- A duration measured on the client is wrong after a reload; prefer the runtime's value,
  and never switch a prop between undefined and defined in a way the component treats as
  a mode change (#496).
- Closing while focus is inside the content drops focus to the body.
- Grouping is the consumer's (it knows the message parts); the component shows one trace.
- Opening the content above the bottom of a following thread must not yank the view
  (assistant-ui #8367): it is the Message Thread's follow rule, and growth above the bottom
  keeps the bottom.

## Testing notes

- Machine in Node on a manual clock: auto-open on start (not on mount), auto-close after the
  delay, the user's toggle wins, focus inside blocks the close, duration from the clock or
  the prop, announcements.
- DOM: trigger text and `aria-expanded`, `aria-controls` only while rendered, `aria-busy`.
- Model: toggles by pointer and keyboard (Collapsible's contract) plus the lifecycle as
  prop steps.

## Decisions

1. **Composes Collapsible** semantics (button + region, `aria-expanded`, `aria-controls` only
   while rendered) in its own machine, because the lifecycle adds states and rules
   Collapsible must not know.
2. **States**: `thinking` / `done`, crossed with open / closed (controllable `open`).
   `thinking` is the consumer's `streaming` prop.
3. **Auto-open** on a live transition into `thinking`, or on mounting thinking (a chat mounts
   the reasoning part when the stream begins); **auto-close** `autoCloseDelay`
   (default 1000 ms) after a live transition into `done`; both only while the user has not
   toggled, and the close is skipped while focus is inside the content. A message that
   mounts done stays as it is (closed by default): that is the old-message case of #86.
4. **Duration**: the `duration` prop (seconds) when given, else measured with the
   Environment's Clock between the live start and end; never on mount.
5. **Announcements**: `messages.thinking` on start and `messages.thought(seconds)` on end,
   polite, keyed per instance; `announce={false}` turns them off.
6. **Trigger text** from the same messages, with the duration; the consumer may render
   its own text (the render state carries `thinking` and `duration`).

## Open questions

- Should the trace be announced on demand (a "read reasoning" action)? Out of scope: the
  user opens it and reads it.
