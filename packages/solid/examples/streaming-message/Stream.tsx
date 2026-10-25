/** @jsxImportSource solid-js */
import { Button, StreamingMessage } from "@rind-ui/solid"
import { createSignal, onCleanup } from "solid-js"

const ANSWER =
  "A headless component owns behaviour and accessibility, and leaves the look to you. " +
  "This one paces bursty chunks so they read evenly, marks the text busy while it grows, " +
  "and announces the start and the end of the response, never each chunk.\n\n" +
  "Your renderer gets the displayed text: plain, markdown, anything."

type Status = "pending" | "streaming" | "complete" | "cancelled" | "error"

export function Stream() {
  // A fake model: bursts of 1 to 12 words every 60 to 240 ms.
  const [text, setText] = createSignal("")
  const [status, setStatus] = createSignal<Status>("pending")
  let timer: ReturnType<typeof setTimeout> | null = null
  const stop = (next: Status) => {
    if (timer) clearTimeout(timer)
    timer = null
    setStatus(next)
  }
  const start = (fail = false) => {
    if (timer) clearTimeout(timer)
    const words = ANSWER.split(/(?<= )/)
    let i = 0
    setText("")
    setStatus("streaming")
    const step = () => {
      i = Math.min(words.length, i + 1 + Math.floor(Math.random() * 12))
      setText(words.slice(0, i).join(""))
      if (fail && i > words.length / 2) return stop("error")
      if (i >= words.length) return stop("complete")
      timer = setTimeout(step, 60 + Math.random() * 180)
    }
    timer = setTimeout(step, 400)
  }
  onCleanup(() => {
    if (timer) clearTimeout(timer)
  })
  return (
    <div style={{ display: "grid", gap: "16px", "inline-size": "min(100%, 560px)" }}>
      <StreamingMessage.Root role="article" aria-label="Assistant" text={text()} status={status()}>
        <StreamingMessage.Content />
        <StreamingMessage.Caret />
      </StreamingMessage.Root>
      <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px" }}>
        <Button disabled={status() === "streaming"} onPress={() => start()}>
          {status() === "pending" ? "Ask" : "Ask again"}
        </Button>
        <Button disabled={status() !== "streaming"} onPress={() => stop("cancelled")}>
          Stop
        </Button>
        <Button disabled={status() === "streaming"} onPress={() => start(true)}>
          Ask and fail
        </Button>
      </div>
    </div>
  )
}
