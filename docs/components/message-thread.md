# Message Thread

The scrolling conversation around the messages. While you are at the bottom it follows the newest content (a streaming answer included); the moment you scroll back to read, it lets go, and counts what arrives on a "jump to latest" button. It is an APG Feed: each message is an article named by its speaker, Page Down / Page Up move between them, and the thread is never a live region (each [Streaming Message](streaming-message.md) announces its own start and end).

## When to use

- **Use it for** a chat with an AI or with people, a comment stream that grows at the end, any feed whose newest item is at the bottom.
- **Over a scrolling `div` with `scrollIntoView`**: it tells your scroll from its own (no snapping back while you read, assistant-ui #8220), keeps the bottom when the prompt grows the layout, follows a fast stream without losing it (#5970), keeps your place when older messages load above (also in Safari), never scrolls the page, and gives keyboard and screen-reader users a navigable list of messages.
- **Don't use it for** a log of system output that nobody navigates by message: a `role="log"` region is simpler.

```tsx
import { MessageThread, StreamingMessage } from "@rind-ui/react"

<MessageThread.Root count={messages.length} lastFromUser={messages.at(-1)?.role === "user"}>
  <MessageThread.Viewport>
    {messages.map((m, i) => (
      <MessageThread.Message key={m.id} index={i} from={m.role}>
        {m.role === "assistant" ? (
          <StreamingMessage.Root text={m.text} status={m.status}>
            <StreamingMessage.Content />
          </StreamingMessage.Root>
        ) : (
          m.text
        )}
      </MessageThread.Message>
    ))}
  </MessageThread.Viewport>
  <MessageThread.JumpToLatest />
</MessageThread.Root>
```

## API

<!-- api:message-thread -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `MessageThread.Root` | `root` | `<div>`; holds the follow state; `data-at-bottom` while at the bottom. |
| `MessageThread.Viewport` | `viewport` | `<div role="feed" tabindex="0">` named "Conversation"; scrolls; `aria-busy` while older messages load. |
| `MessageThread.Message` | `message` | `<div role="article" tabindex="-1">` with `aria-posinset` / `aria-setsize`, named "You", "Assistant" or "System" from `from`. |
| `MessageThread.JumpToLatest` | `jump-to-latest` | `<button>` rendered while reading back; named "3 new messages, jump to latest"; empty, the theme draws a down arrow. |

## Following

| State | Meaning |
|---|---|
| `following` | At the bottom. New messages and growth keep the view there (bottom layout). |
| `detached` | You scrolled up, wheeled up, or are selecting text: nothing moves the view; new messages are counted. |

Scrolling back to within `bottomThreshold` (32 px) of the bottom follows again; so does sending a message (`lastFromUser` turning true with a new message), and pressing JumpToLatest. Growth is tracked instantly; jumps are smooth, or instant under reduced motion.

## Layouts

- `anchor="bottom"` (default): the classic chat; the newest content stays in view.
- `anchor="top"`: your new message is scrolled to the top of the viewport and the answer grows below it without moving the view (the reading layout of ChatGPT and Claude). Room is reserved below your message so it can reach the top while the answer is still short.

## Older messages

Reaching the top calls `onLoadOlder`. Pass `loadingOlder` while they load (the feed is `aria-busy`), then prepend them: the message you were reading stays exactly where it was. Pass `total` when you know the thread's full length, so `aria-setsize` is right while only part of it is loaded.

## Virtualization

The thread does not window its messages; use your virtualizer (TanStack Virtual, virtua) inside the Viewport and keep `index` the message's index in the whole thread. Keep the last message and the focused one mounted, so the follow and Page Down / Up have a target.

## Keyboard

| Key | Action |
|---|---|
| Tab | To the Viewport (it scrolls with the arrow keys), then into the messages' own controls. |
| Page Down / Page Up | Focus the next / previous message. |
| Ctrl+End / ⌘End | Leave the thread forward (to the prompt). |
| Ctrl+Home / ⌘Home | Leave the thread backward. |
| Enter, Space | On JumpToLatest: back to the latest; by keyboard, focus lands on the last message. |

A text field inside a message keeps these keys.

## Accessibility notes

- **Never a live region.** `role="feed"` is not live; messages announce their own lifecycle. `role="log"` on a conversation (AI Elements) reads a streaming answer chunk by chunk.
- **Speakers in text.** Each article is named by its speaker, not only by side or colour.
- **A focusable scroll region** (WCAG 2.1.1), named.
- **No page scroll.** The thread scrolls its viewport only, never the page.
- **Reduced motion**: jumps are instant.

## Testing

```tsx
import { getMessageThread } from "@rind-ui/testing"

const thread = getMessageThread(screen, { name: "Conversation" })
await thread.scrollUp()
expect(await thread.state()).toBe("detached")
await thread.jump()
expect(await thread.isAtBottom()).toBe(true)
```

Contract actions: `scrollUp`, `scrollToBottom` (wheel), `jump`, `nextMessage`, `previousMessage`. Queries: `state`, `isAtBottom`, `unread`, `focusedMessage`, `messageCount`. Scrolling needs layout: run these in a browser (Vitest browser mode or Playwright).

## Tested with

<!-- tested-with:message-thread -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
