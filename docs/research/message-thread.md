# Message Thread — research

The scrolling conversation around the messages: it follows the newest content while the
user is at the bottom, lets go the moment the user reads back, offers a way back to the
latest, keeps its place when older messages load above, and exposes the messages to
assistive technology as a navigable sequence of articles rather than a live region. Each
message is a [Streaming Message](streaming-message.md) or the consumer's own element.

None of the nine headless libraries ships it. The AI kits do.

Sources read (October 2026): use-stick-to-bottom (`stackblitz-labs/use-stick-to-bottom`,
`src/useStickToBottom.ts`; used by AI Elements' `Conversation` and prompt-kit's
`ChatContainer`), Vercel AI Elements (`packages/elements/src/conversation.tsx`),
assistant-ui (`primitives/thread/ThreadViewport.tsx`, its auto-scroll hook), virtua's issue
tracker (the virtualizer chat apps use for reverse lists), the APG Feed pattern, and the
issue trackers of all of them.

## Pattern

- **APG Feed** (`role="feed"` of `role="article"`s): a scrollable list of articles where
  new ones load as the user reads. Articles carry `aria-posinset` / `aria-setsize` (`-1`
  when unknown) and a label; the feed carries `aria-busy` while articles are added in
  several DOM operations, and it must be set back to `false`. Keyboard: Page Down / Page
  Up move focus between articles, Control+End / Control+Home leave the feed after / before.
  Screen readers in reading mode move focus to the article they read, which is what lets
  the page load more.
- **`role="log"`** is the other candidate. It implies `aria-live="polite"`, so everything
  added inside it, a streaming message included, is announced as it arrives. The tested
  advice is `role="log"` with `aria-live="off"`, which keeps the semantics and drops the
  announcements (see the Streaming Message research).
- **Scroll region**: when the thread scrolls, the scroll container must be reachable by
  keyboard (WCAG 2.1.1; `tabindex="0"` and a name), or its content is unreachable for
  keyboard users with no focusable element inside (axe `scrollable-region-focusable`).

## How the others built it

### use-stick-to-bottom (StackBlitz; AI Elements, prompt-kit)

- Two flags: `isAtBottom` (the view follows new content) and `escapedFromLock` (the user
  left on purpose). Near the bottom means within 70 px.
- A ResizeObserver on the content follows growth with a spring animation (or `instant`),
  remembering the resize difference so its own programmatic scrolls are not mistaken for
  the user's.
- **Escapes**: a scroll upward escapes; a wheel event upward on the scroller escapes at
  once (the browser cancels a wheel scroll that fights an animation); a text selection in
  progress escapes (the view must not move under a dragged selection). Scrolling back down
  to the bottom re-attaches.
- Scroll events are checked one task later (`setTimeout(…, 1)`) because a scroll event can
  precede the ResizeObserver's callback.
- `scrollToBottom()` returns a promise, can ignore escapes while it animates, and is what
  the "scroll to bottom" button calls.

### Vercel AI Elements (`Conversation`, `ConversationContent`, `ConversationScrollButton`)

- `StickToBottom` with `initial="smooth"` and `resize="smooth"`, and **`role="log"` on the
  whole conversation**: every streamed chunk inside it is announced (the pitfall above).
- The scroll button renders only when not at the bottom, with an icon and no text name
  in the default.

### assistant-ui (`ThreadPrimitive.Viewport`, `ScrollToBottom`)

- `autoScroll` follows growth while at the bottom; `scrollToBottomOnRunStart`,
  `scrollToBottomOnInitialize`, `scrollToBottomOnThreadSwitch` (all default true).
- `turnAnchor`: `"bottom"` (classic chat) or `"top"`: a new user message is anchored at the
  top of the viewport and the answer grows below it, with no auto-follow (the reading
  layout ChatGPT and Claude moved to); tall user messages are clamped
  (`topAnchorMessageClamp`) so the answer stays in view. A spacer reserves the room below.
- `ScrollToBottom` is a button disabled while at the bottom.

### Not shipped

Radix, React Aria, Ark / Zag, Base UI, Headless UI, Ariakit, Kobalte, Reka, Melt. React Aria
and Ariakit have no feed; rind-ui's collections own list keyboard navigation.

## Accessibility

- **Not a live region.** The thread must not announce what it receives; messages announce
  their own lifecycle (Streaming Message). `role="feed"` is not live; `role="log"` must come
  with `aria-live="off"`.
- **Articles with a speaker.** Each message is an `article` named by its speaker and
  position ("You", "Assistant"), so reading mode and the feed keys can move between them
  and the speaker is in text, not only in layout or colour.
- **Keyboard**: the scroll region is focusable when it scrolls; Page Down / Page Up between
  messages (feed); Control+End leaves to the prompt. Messages contain their own controls
  (copy, regenerate), which take Tab as usual.
- **Jump to latest** is a real button with a text name ("Jump to latest message"), present
  only while detached, and focus goes to the latest message's article when it is used by
  keyboard (so the reading position moves with the view).
- **New content while detached** is not announced per message; the button can say how
  many arrived ("3 new messages").
- **Reduced motion**: scrolling is instant, never smooth.
- **Loading older messages** sets `aria-busy` on the feed until the batch is in, and keeps
  the reading position (no jump).

## Bug history

use-stick-to-bottom:
- #40 (open) the position drifts when the scroll container's height changes (a flex
  sibling, the prompt growing). #32 (open) Safari at 85 % zoom keeps jumping (sub-pixel
  bottom detection). #9 (open) bad on iOS. #10 (closed) not at the bottom on first render.
  #29 (closed) `initial="instant"` ignored. #31 (closed) the ResizeObserver was not
  disconnected. #7 (closed) nested scrollable children triggered auto-scroll. #3 (closed)
  stop following once the streamed answer reaches the top of the viewport.

assistant-ui:
- #5970 (closed) `turnAnchor="bottom"` stopped following mid-stream on a fast growth burst
  and never re-armed. #6315 (closed) the viewport jumped at the end of a stream in Safari.
  #8211 (closed) stopping a scroll short of the bottom left the button hidden. #8220
  (closed) a scroll-up in the same frame as the viewport's own scroll was missed and the
  next update scrolled back down. #8996 (closed) observers recreated on every render.

virtua (reverse lists for chat):
- #883 (closed) the first prepend after mounting jumped to the latest rows. #636 (closed)
  reverse infinite scroll miscalculated the offset for dynamic heights. #408, #301 (closed)
  the list did not stay at the bottom when items or the viewport resized. #346 (closed)
  dragging the scrollbar up was unstable. #367 (closed) prepending in Safari. #284 (open)
  `shift` artifacts.

AI Elements: `role="log"` on the conversation (design, no issue): streamed chunks are read
as they arrive.

## Known pitfalls

- Programmatic scrolls produce scroll events: tell them from the user's (remember the
  target, ignore the event that lands on it).
- Content growth and container shrink are different: a prompt that grows shrinks the
  viewport; staying at the bottom must hold for both (use-stick-to-bottom #40).
- Sub-pixel heights: "at the bottom" needs a tolerance, never an exact equality
  (Safari zoom, #32).
- A wheel or touch upward must win immediately against an in-flight smooth scroll.
- A text selection being dragged must stop the follow.
- Prepending older messages must keep the first visible message where it was: native
  `overflow-anchor` works in Chromium and Firefox, not in Safari (no support), so the
  offset must be restored by hand there.
- `scrollIntoView` scrolls every scrollable ancestor (the page too); scroll the viewport
  itself.

## Testing notes

- Machine in Node: following / detached / the escape rules (scroll up, wheel up, selection,
  user scroll back to the bottom), new content while following vs detached, send re-attaches,
  jump to latest.
- Pure geometry in Node: at-bottom with tolerance, the prepend offset correction.
- Browser: real scrolling with content growth (a Streaming Message), container resize,
  wheel, keyboard Page Down / Up between articles, the button's focus target, reduced
  motion instant, Safari prepend without `overflow-anchor`.
- Invariants: the thread is never a live region; every message is an article with a name;
  the jump button exists iff detached.

## Decisions

1. **`role="feed"` of `article`s** by default (APG Feed: keyboard, `aria-posinset`,
   `aria-busy` for loads), never a live region. The research found no test of feed support
   in NVDA and VoiceOver for chats: the tier-1 AT pass decides whether `role="log"` with
   `aria-live="off"` must be the alternative.
2. **A follow machine**: `following` / `detached`, with use-stick-to-bottom's escape rules
   (upward scroll or wheel, selection), "at the bottom" within a tolerance (`bottomThreshold`,
   default 32 px rather than use-stick-to-bottom's 70), programmatic scrolls recognised by
   their target.
3. **Anchoring**: `anchor="bottom"` (follow growth) or `"top"` (a new user turn scrolls to
   the top of the viewport and the answer grows below without follow), assistant-ui's two
   layouts.
4. **Messages come from the consumer** (`Thread.Message` per item, with `role` "user" /
   "assistant" / "system" for the name); virtualization is the consumer's, as in rind-ui's
   collections, with the focused and the last message kept mounted.
5. **Jump to latest** part: rendered while detached, named with the count of new messages,
   focusing the latest article when activated by keyboard.
6. **Prepend**: an `onLoadOlder` request when the top is reached, `aria-busy` on the feed
   until the consumer reports the batch in, and the scroll offset restored by hand when
   `overflow-anchor` is unsupported.

## Open questions

- Feed vs log with live off for NVDA and JAWS: tier-1 AT pass.
- Should Page Down / Page Up move between messages while focus is inside a message's own
  text field (an edit box)? APG says the widget keeps its keys; same here.
