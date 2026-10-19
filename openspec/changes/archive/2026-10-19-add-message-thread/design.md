## Context

The research note ([message-thread.md](../../../docs/research/message-thread.md)) compares
use-stick-to-bottom (AI Elements, prompt-kit), assistant-ui's Viewport and virtua, the APG
Feed pattern, and their bug histories.

## Goals / Non-Goals

**Goals:**
- A machine that decides follow / detach in Node, from scroll facts the DOM layer reports.
- A DOM module that tells the user's scrolls from the component's own, and keeps the
  bottom (or the reading position) through content growth, container resize and prepends.
- Feed semantics and keyboard; never a live region.

**Non-Goals:**
- A virtualizer: the consumer's (TanStack Virtual, virtua). The thread keeps working with
  windowed rendering, and the docs give a recipe.
- Message content, actions or grouping (Streaming Message, Message Actions).

## Decisions

### 1. Props

```ts
anchor?: "bottom" | "top"          // default "bottom"
bottomThreshold?: number           // px, default 32
count: number                      // messages in the thread (or loaded)
lastFromUser?: boolean             // the newest message is the user's (re-attach, top anchor)
loadingOlder?: boolean             // the consumer is loading older messages (aria-busy)
onLoadOlder?: () => void           // the top was reached
messages?: Partial<MessageThreadMessages>
```

### 2. Machine

States `following` and `detached`. Context: `unread` (messages added while detached),
`count` (the last count seen), `reduced`.

Events:

```ts
| { type: "SCROLLED"; atBottom: boolean; up: boolean }  // a user scroll (never the component's)
| { type: "ESCAPE" }                                     // an upward wheel, or a selection drag
| { type: "COUNT.SYNCED" }                               // `count` or `lastFromUser` changed
| { type: "JUMP"; modality: Modality }                   // JumpToLatest pressed
| { type: "MOTION.CHANGED"; reduced: boolean }
```

- `following`: `SCROLLED` with `up` or `ESCAPE` → `detached`. A `COUNT.SYNCED` asks for a
  scroll to the bottom (effect).
- `detached`: `SCROLLED` with `atBottom` → `following` (unread cleared). `COUNT.SYNCED`
  adds the new messages to `unread`, except that a new user message re-attaches
  (`following`, scroll to the bottom) when `anchor` is "bottom".
- `JUMP` → `following`, unread cleared, a scroll to the bottom. With keyboard or virtual
  modality, focus moves to the last message's article.
- `anchor="top"`: the machine never follows. A new user message asks for that message to
  be scrolled to the top (effect `revealTurn`), and the state is `detached`, so growth
  never moves the view.
- Scrolling is `instant` under reduced motion, else `smooth`.

### 3. `core/dom/stick-to-bottom.ts`

- `atBottom(el, threshold)`: `scrollHeight - clientHeight - scrollTop <= threshold`
  (a tolerance, never equality: Safari zoom, use-stick-to-bottom #32).
- `watchScroll(el, { onUserScroll, onEscape })`:
  - a scroll listener compares with the last `scrollTop` and ignores the scroll the
    component asked for: its target is remembered, and the event that lands within 1 px of
    it is the component's;
  - an upward `wheel` on the scroller itself escapes at once;
  - a `selectionchange` while the primary button is down inside the scroller escapes.
- `keepBottom(el, content, isFollowing, behavior)`: one ResizeObserver on the scroller and
  the content. While following, it scrolls to the bottom (programmatic, remembered) on any
  growth of the content or shrink of the scroller (use-stick-to-bottom #40).
- `scrollToBottom(el, behavior)`, `scrollMessageToTop(el, message, behavior)`. Both set
  `scrollTop` on the viewport only, never `scrollIntoView` (it scrolls the page too).
- `preservePrepend`: before a commit that changes the first message, record `scrollHeight -
  scrollTop`; after it, restore `scrollTop` from it. The viewport sets
  `overflow-anchor: none`, so browsers that anchor natively do not compensate twice (and
  Safari, which does not anchor, behaves the same).
- `onTopReached(el, cb)`: an IntersectionObserver on a sentinel at the top calls
  `onLoadOlder`.

### 4. Connect

Parts `root`, `viewport`, `message`, `jump-to-latest`. Every part carries `data-scope`,
`data-part`, `data-instance`, `data-state` (`following` / `detached`) and `data-anchor`.
- Viewport: `role="feed"`, `aria-label` = `messages.label` ("Conversation") unless the
  consumer names it, `tabindex="0"`, `aria-busy="true"` while `loadingOlder`. Inline
  `overflow-y: auto`, `overflow-anchor: none`.
- Message: `role="article"`, `tabindex="-1"`, `aria-posinset` (index + 1),
  `aria-setsize` (`count`, or -1 when `total` is unknown), `aria-label` =
  `messages.messageLabel({ from, index })` unless named. `from` is "user", "assistant" or
  "system". `data-from`.
- JumpToLatest: `type="button"`, `aria-label` = `messages.jumpLabel(unread)` ("Jump to
  latest message", "3 new messages, jump to latest"); rendered only while detached and
  not at the bottom.

Messages: `label`, `messageLabel({ from, index })` ("You", "Assistant", "System"),
`jumpLabel(unread, locale)`.

### 5. Keyboard (feed)

On the viewport (React handler, rules in connect):
- Page Down / Page Up: focus the next / previous message's article (from the focused
  message, or from the first visible one), scrolled into the viewport (`block: nearest`,
  on the viewport only).
- Control+End / Control+Home: focus the first focusable element after / before the
  thread (the prompt).
- A widget inside a message that uses these keys keeps them (the event is ignored when its
  target is a text field or has its own `aria-keyshortcuts`).

### 6. React

- `MessageThread.Root` owns the machine and context.
- `MessageThread.Viewport` runs `watchScroll`, `keepBottom`, the prepend preservation and
  the top sentinel.
- `MessageThread.Message` takes `index` and `from`. It registers its element, so the last
  message and the user's turn can be found.
- `MessageThread.JumpToLatest`: a press sends `JUMP` with its modality.

### 7. Contract

Located by role `feed` and its name. Actions: `scrollUp` (wheel), `scrollToBottom` (user
scroll), `jump`, `nextMessage` / `previousMessage` (Page Down / Up). Queries: `state`,
`isAtBottom`, `unread`, `focusedMessage`, `messageCount`. Invariants: the feed has no
`aria-live`, every message is an `article` with a name and a position, and JumpToLatest
is rendered iff detached.

### 8. Theme

`message-thread.css`, family `decoration`: the viewport fills its box and scrolls, messages
stack with a gap, `data-from="user"` aligns at the inline end, and the jump button floats
at the bottom centre with an arrow icon. Focus rings on the viewport and on articles.
`scroll-behavior` is not set (the component decides).

## Risks / Trade-offs

- Feed support in NVDA, JAWS and VoiceOver for chats is untested in the research. If the
  tier-1 pass finds problems, `role="log"` with `aria-live="off"` is the fallback (a
  prop).
- The 1 px tolerance for recognising programmatic scrolls can misclassify a user scroll
  of exactly that size. A follow is then kept for one event, which is harmless.
- Windowed rendering removes articles from the DOM. `aria-setsize` and `aria-posinset`
  keep their positions meaningful, but Page Down past the window depends on the
  consumer's virtualizer rendering the next one.
