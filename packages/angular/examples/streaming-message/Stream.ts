import { Component, DestroyRef, inject, signal } from "@angular/core"
import { Button, StreamingMessage } from "@rind-ui/angular"

const ANSWER =
  "A headless component owns behaviour and accessibility, and leaves the look to you. " +
  "This one paces bursty chunks so they read evenly, marks the text busy while it grows, " +
  "and announces the start and the end of the response, never each chunk.\n\n" +
  "Your renderer gets the displayed text: plain, markdown, anything."

type Status = "pending" | "streaming" | "complete" | "cancelled" | "error"

@Component({
  selector: "app-stream",
  imports: [Button, StreamingMessage],
  template: `
    <div style="display: grid; gap: 16px; inline-size: min(100%, 560px)">
      <div rindStreamingMessageRoot role="article" aria-label="Assistant" [text]="text()" [status]="status()">
        <div rindStreamingMessageContent></div>
        <span rindStreamingMessageCaret></span>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px">
        <button rindButton [disabled]="status() === 'streaming'" (press)="start()">
          {{ status() === "pending" ? "Ask" : "Ask again" }}
        </button>
        <button rindButton [disabled]="status() !== 'streaming'" (press)="stop('cancelled')">Stop</button>
        <button rindButton [disabled]="status() === 'streaming'" (press)="start(true)">Ask and fail</button>
      </div>
    </div>
  `,
})
export class Stream {
  // A fake model: bursts of 1 to 12 words every 60 to 240 ms.
  readonly text = signal("")
  readonly status = signal<Status>("pending")
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer)
    })
  }

  stop(next: Status) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.status.set(next)
  }

  start(fail = false) {
    if (this.timer) clearTimeout(this.timer)
    const words = ANSWER.split(/(?<= )/)
    let i = 0
    this.text.set("")
    this.status.set("streaming")
    const step = () => {
      i = Math.min(words.length, i + 1 + Math.floor(Math.random() * 12))
      this.text.set(words.slice(0, i).join(""))
      if (fail && i > words.length / 2) return this.stop("error")
      if (i >= words.length) return this.stop("complete")
      this.timer = setTimeout(step, 60 + Math.random() * 180)
    }
    this.timer = setTimeout(step, 400)
  }
}
