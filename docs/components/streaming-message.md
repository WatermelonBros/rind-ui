# Streaming Message

One AI response that arrives in chunks. You pass the `text` received so far and the `status` from your chat runtime; the component paces bursty chunks so they read evenly, marks the text busy while it grows, draws a caret, and announces the start and the end of the response, never a chunk. Rendering the text (plain, markdown) stays yours: `Content` hands your renderer the displayed text.

## When to use

- **Use it for** each assistant response in a chat, or any text an AI writes into the page as it arrives.
- **Over rendering the string yourself**: a body that is never a live region (screen readers would read it chunk by chunk), lifecycle announcements ("Generating a response", "Response complete"), `aria-busy` while it grows, an even reveal that still finishes on time, a caret that is not spliced into your markdown, and cancel or failure that keep everything received.
- **Don't use it for** text the user writes, or for a log of system output: use a plain element, or Message Thread for the conversation around it.

```tsx
import { StreamingMessage } from "@rind-ui/react"

<StreamingMessage.Root role="article" aria-label="Assistant" text={message.text} status={message.status}>
  <StreamingMessage.Content>{(text) => <Markdown>{text}</Markdown>}</StreamingMessage.Content>
  <StreamingMessage.Caret />
</StreamingMessage.Root>
```

`status` is `"pending"`, `"streaming"`, `"complete"`, `"cancelled"` or `"error"`. With the Vercel AI SDK, map `useChat`'s `status` for the last message (`"submitted"` → `pending`, `"streaming"` → `streaming`, `"ready"` → `complete`, `"error"` → `error`, `stop()` → `cancelled`).

## API

<!-- api:streaming-message -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `StreamingMessage.Root` | `root` | `<div>`, no role of its own; in a thread give it `role="article"` and a name ("Assistant said"). |
| `StreamingMessage.Content` | `content` | `<div>`; `children(text, state)` for your renderer, a node, or nothing (plain text, line breaks kept). `aria-busy` while busy. |
| `StreamingMessage.Caret` | `caret` | `<span aria-hidden>`, only while busy; empty, the theme draws a blinking bar. |

Every part carries `data-state` and `data-busy` while busy.

## States

| State | Meaning |
|---|---|
| `pending` | No text yet. |
| `streaming` | Text is arriving. |
| `settling` | The stream ended; the reveal is catching up (still busy, announced when done). |
| `complete` | Everything is shown. |
| `cancelled` | Stopped; everything received is shown at once. |
| `error` | Failed; everything received is shown at once. |

## The reveal

With `smooth` (default on), each chunk is revealed at a pace that drains it in `drainMs` (250 ms), never slower than one character per `maxCharIntervalMs` (5 ms). Text present at mount (a reloaded thread, the server render) is shown at once. If the text stops being an extension of what is shown (an edit, a regenerate), the reveal restarts. Under reduced motion, and with `smooth={false}`, every chunk shows at once.

## Announcements

| `announce` | What is said (politely) |
|---|---|
| `"status"` (default) | "Generating a response", then "Response complete", "Response cancelled" or "The response failed". |
| `"text"` | The complete response once, at the end. |
| `"sentences"` | Each sentence as it completes, the rest at the end. |
| `"none"` | Nothing: a Message Thread or your app announces instead. |

A message that mounts complete announces nothing, so reloading a conversation is silent. Change the words with `messages`.

## Accessibility notes

- **Never a live region.** The growing text is not inside `aria-live` (or a `role="log"`), which screen readers read chunk by chunk; the lifecycle is announced through the shared announcer instead.
- **`aria-busy`** on the Content while busy holds some screen readers' reading of it; the announcements do not depend on it.
- **Focus never moves** on start or completion.
- **Name the speaker** in text: give the Root a name ("Assistant said"), not only a side or a colour.
- **The caret** is decorative and stops blinking under reduced motion.

## Testing

```tsx
import { getStreamingMessage, virtualClock } from "@rind-ui/testing"

const clock = virtualClock()
// <RindProvider environment={{ scheduler: clock.scheduler }}> … status="streaming"
const message = getStreamingMessage(screen, { name: "Assistant" })
expect(await message.isBusy()).toBe(true)
// … status="complete"
act(() => clock.advance(1000))
expect(await message.state()).toBe("complete")
expect(await message.text()).toBe("The full answer.")
```

Contract action: `waitForReveal` (advances the clock). Queries: `state`, `text`, `isBusy`, `hasCaret`.

## Tested with

<!-- tested-with:streaming-message -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
