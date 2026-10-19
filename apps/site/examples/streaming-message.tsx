"use client"

import { Button, StreamingMessage, type StreamingMessageRootProps } from "@rind-ui/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { States, Variants } from "./types"

/** `streaming` and `settling` last while a response arrives: reached by the Stream example. */
/** Inline layout: theme pages do not load the site's helper classes. */
const STACK = { display: "grid", gap: 16, inlineSize: "min(100%, 560px)" } as const
const ROW = { display: "flex", flexWrap: "wrap", gap: 8 } as const

export const states: States = {
  "streaming-message": {
    pending: "Pending",
    complete: "Complete",
    cancelled: "Cancelled",
    error: "Failed",
  },
}

const ANSWER =
  "A headless component owns behaviour and accessibility, and leaves the look to you. " +
  "This one paces bursty chunks so they read evenly, marks the text busy while it grows, " +
  "and announces the start and the end of the response, never each chunk.\n\n" +
  "Your renderer gets the displayed text: plain, markdown, anything."

type Status = StreamingMessageRootProps["status"]

/** A fake model: bursts of 1 to 12 words every 60 to 240 ms. */
function useFakeStream() {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<Status>("pending")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = (next: Status) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setStatus(next)
  }
  const start = (fail = false) => {
    if (timer.current) clearTimeout(timer.current)
    const words = ANSWER.split(/(?<= )/)
    let i = 0
    setText("")
    setStatus("streaming")
    const step = () => {
      i = Math.min(words.length, i + 1 + Math.floor(Math.random() * 12))
      setText(words.slice(0, i).join(""))
      if (fail && i > words.length / 2) return stop("error")
      if (i >= words.length) return stop("complete")
      timer.current = setTimeout(step, 60 + Math.random() * 180)
    }
    timer.current = setTimeout(step, 400)
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  return { text, status, start, stop }
}

function Message({
  label = "Assistant",
  children,
  ...props
}: StreamingMessageRootProps & {
  readonly label?: string
  readonly children?: ReactNode
}) {
  return (
    <StreamingMessage.Root role="article" aria-label={label} {...props}>
      {children ?? <StreamingMessage.Content />}
      <StreamingMessage.Caret />
    </StreamingMessage.Root>
  )
}

export function Stream() {
  const { text, status, start, stop } = useFakeStream()
  const busy = status === "streaming"
  return (
    <div style={STACK}>
      <Message text={text} status={status} />
      <div style={ROW}>
        <Button onPress={() => start()} disabled={busy}>
          {status === "pending" ? "Ask" : "Ask again"}
        </Button>
        <Button onPress={() => stop("cancelled")} disabled={!busy}>
          Stop
        </Button>
        <Button onPress={() => start(true)} disabled={busy}>
          Ask and fail
        </Button>
      </div>
    </div>
  )
}

/** A tiny renderer: paragraphs from blank lines. Swap in Streamdown or react-markdown. */
function Paragraphs({ text }: { readonly text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs only grow at the end.
        <p key={i}>{p}</p>
      ))}
    </>
  )
}

export function CustomRenderer() {
  const { text, status, start } = useFakeStream()
  return (
    <div style={STACK}>
      <Message text={text} status={status} label="Assistant, paragraphs">
        <StreamingMessage.Content>
          {(shown) => <Paragraphs text={shown} />}
        </StreamingMessage.Content>
      </Message>
      <div style={ROW}>
        <Button onPress={() => start()} disabled={status === "streaming"}>
          Ask
        </Button>
      </div>
    </div>
  )
}

export function ReadAloud() {
  const { text, status, start } = useFakeStream()
  return (
    <div style={STACK}>
      <Message text={text} status={status} announce="sentences" label="Assistant, read aloud" />
      <div style={ROW}>
        <Button onPress={() => start()} disabled={status === "streaming"}>
          Ask
        </Button>
      </div>
    </div>
  )
}

export function Pending() {
  return <Message text="" status="pending" label="Assistant, waiting" />
}

export function Complete() {
  return <Message text={ANSWER} status="complete" label="Assistant, complete" />
}

export function Cancelled() {
  return <Message text={ANSWER.slice(0, 120)} status="cancelled" label="Assistant, cancelled" />
}

export function Failed() {
  return <Message text={ANSWER.slice(0, 80)} status="error" label="Assistant, failed" />
}

export const variants: Variants = {
  Stream: {
    title: "Streaming",
    description:
      "Bursty chunks revealed evenly; busy with a caret while it grows; the start and the end announced. Stop cancels, keeping what arrived.",
    motion: "keep",
  },
  CustomRenderer: {
    title: "Your renderer",
    description:
      "`Content`'s children as a function get the displayed text: plug in your markdown.",
    motion: "keep",
  },
  ReadAloud: {
    title: "Read aloud",
    description: '`announce="sentences"`: each sentence is announced as it completes.',
    motion: "keep",
  },
  Pending: { title: "Pending", description: "No text yet." },
  Complete: {
    title: "Complete",
    description: "A message that mounts complete shows its text at once and announces nothing.",
  },
  Cancelled: { title: "Cancelled", description: "Everything received stays shown." },
  Failed: {
    title: "Failed",
    description: "Everything received stays shown; the failure is announced.",
  },
}
