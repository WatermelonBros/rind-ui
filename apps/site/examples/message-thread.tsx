"use client"

import {
  MessageThread,
  type MessageThreadRootProps,
  PromptInput,
  StreamingMessage,
  type StreamingMessageRootProps,
} from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import type { States, Variants } from "./types"

/** `detached` lasts while the reader scrolls back: reached by scrolling any example up. */
export const states: States = { "message-thread": { following: "Chat" } }

type Status = StreamingMessageRootProps["status"]
interface Msg {
  readonly id: number
  readonly from: "user" | "assistant"
  readonly text: string
  readonly status: Status
}

const REPLIES = [
  "Sure. A thread follows the newest message while you are at the bottom, and lets go the moment you scroll back to read.",
  "While you read back, new messages are counted on the jump button instead of moving the page under you. Press it to return; by keyboard, focus lands on the latest message.",
  "Page Down and Page Up move between messages, and Control+End leaves the thread for the prompt.",
]

const history = (n: number, first = 0): Msg[] =>
  Array.from({ length: n }, (_, i) => {
    const id = first + i
    return {
      id,
      from: id % 2 === 0 ? "user" : "assistant",
      text:
        id % 2 === 0
          ? `Question ${id / 2 + 1}: how does the thread behave?`
          : (REPLIES[((id - 1) / 2) % REPLIES.length] ?? ""),
      status: "complete" as const,
    }
  })

/** A fake chat: the answer streams in bursts after each question. */
function useChat(initial: Msg[]) {
  const [list, setList] = useState(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const ask = (question: string) => {
    const base = list.length
    const reply = REPLIES[(base / 2) % REPLIES.length] ?? ""
    setList((l) => [
      ...l,
      { id: base, from: "user", text: question, status: "complete" },
      { id: base + 1, from: "assistant", text: "", status: "pending" },
    ])
    const words = reply.split(/(?<= )/)
    let i = 0
    const step = () => {
      i = Math.min(words.length, i + 1 + Math.floor(Math.random() * 6))
      const done = i >= words.length
      setList((l) =>
        l.map((m) =>
          m.id === base + 1
            ? { ...m, text: words.slice(0, i).join(""), status: done ? "complete" : "streaming" }
            : m,
        ),
      )
      if (!done) timer.current = setTimeout(step, 80 + Math.random() * 160)
    }
    timer.current = setTimeout(step, 300)
  }
  const busy = list.some((m) => m.status === "pending" || m.status === "streaming")
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    setList((l) =>
      l.map((m) =>
        m.status === "pending" || m.status === "streaming" ? { ...m, status: "cancelled" } : m,
      ),
    )
  }
  return { list, setList, ask, stop, busy }
}

function Thread({
  list,
  ...props
}: { readonly list: readonly Msg[] } & Partial<MessageThreadRootProps>) {
  return (
    <MessageThread.Root
      className="thread"
      count={list.length}
      lastFromUser={list.at(-1)?.from === "user" || list.at(-2)?.from === "user"}
      {...props}
    >
      <MessageThread.Viewport>
        {list.map((m, i) => (
          <MessageThread.Message key={m.id} index={i} from={m.from}>
            {m.from === "assistant" ? (
              <StreamingMessage.Root
                text={m.text}
                status={m.status}
                announce={i === list.length - 1 ? "status" : "none"}
              >
                <StreamingMessage.Content />
                <StreamingMessage.Caret />
              </StreamingMessage.Root>
            ) : (
              m.text
            )}
          </MessageThread.Message>
        ))}
      </MessageThread.Viewport>
      <MessageThread.JumpToLatest />
    </MessageThread.Root>
  )
}

/** The thread and its composer share one column, so their edges line up in every skin. */
const COLUMN = {
  display: "grid",
  gap: 12,
  inlineSize: "min(100%, 560px)",
} as const

const ArrowUp = () => (
  <svg aria-hidden="true" viewBox="0 0 256 256" width="18" height="18" fill="currentColor">
    <path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z" />
  </svg>
)
const Square = () => (
  <svg aria-hidden="true" viewBox="0 0 256 256" width="14" height="14" fill="currentColor">
    <rect x="40" y="40" width="176" height="176" rx="24" />
  </svg>
)

/** rind-ui's Prompt Input: full width under the thread; Stop cancels the streaming answer. */
function Prompt({
  onAsk,
  onStop,
  busy,
}: {
  readonly onAsk: (q: string) => void
  readonly onStop: () => void
  readonly busy: boolean
}) {
  return (
    <PromptInput.Root
      status={busy ? "streaming" : "idle"}
      onSubmit={({ text }) => onAsk(text)}
      onStop={onStop}
    >
      <PromptInput.Label>Message</PromptInput.Label>
      <PromptInput.Textarea placeholder="Ask about the thread" />
      <PromptInput.Submit>{busy ? <Square /> : <ArrowUp />}</PromptInput.Submit>
    </PromptInput.Root>
  )
}

export function Chat() {
  const { list, ask, stop, busy } = useChat(history(8))
  return (
    <div style={COLUMN}>
      <Thread list={list} />
      <Prompt onAsk={ask} onStop={stop} busy={busy} />
    </div>
  )
}

export function TopAnchor() {
  const { list, ask, stop, busy } = useChat(history(4))
  return (
    <div style={COLUMN}>
      <Thread list={list} anchor="top" />
      <Prompt onAsk={ask} onStop={stop} busy={busy} />
    </div>
  )
}

export function LoadOlder() {
  const { list, setList, ask, stop, busy } = useChat(history(6, 30))
  const [loading, setLoading] = useState(false)
  const first = list[0]?.id ?? 0
  const load = () => {
    if (first <= 0 || loading) return
    setLoading(true)
    setTimeout(() => {
      setList((l) => [...history(Math.min(6, first), Math.max(0, first - 6)), ...l])
      setLoading(false)
    }, 600)
  }
  return (
    <div style={COLUMN}>
      <Thread list={list} total={36} loadingOlder={loading} onLoadOlder={load} />
      <Prompt onAsk={ask} onStop={stop} busy={busy} />
    </div>
  )
}

export const variants: Variants = {
  Chat: {
    title: "Chat",
    description:
      "Follows the streaming answer while at the bottom; scroll up and it lets go, counting new messages on the jump button. Page Down / Page Up between messages.",
    motion: "keep",
  },
  TopAnchor: {
    title: "Top anchor",
    description: '`anchor="top"`: your question goes to the top and the answer grows below it.',
    motion: "keep",
  },
  LoadOlder: {
    title: "Load older",
    description:
      "Reaching the top calls `onLoadOlder`; the feed is busy while they load, and your place is kept.",
    motion: "keep",
  },
}
