import { Component, computed, DestroyRef, inject, signal } from "@angular/core"
import { MessageThread, PromptInput, StreamingMessage } from "@rind-ui/angular"

const REPLIES = [
  "Sure. A thread follows the newest message while you are at the bottom, and lets go the moment you scroll back to read.",
  "While you read back, new messages are counted on the jump button instead of moving the page under you. Press it to return; by keyboard, focus lands on the latest message.",
  "Page Down and Page Up move between messages, and Control+End leaves the thread for the prompt.",
]

type Status = "pending" | "streaming" | "complete" | "cancelled" | "error"
interface Msg {
  readonly id: number
  readonly from: "user" | "assistant"
  readonly text: string
  readonly status: Status
}

const history = (n: number): Msg[] =>
  Array.from({ length: n }, (_, id) => ({
    id,
    from: id % 2 === 0 ? "user" : "assistant",
    text:
      id % 2 === 0
        ? `Question ${id / 2 + 1}: how does the thread behave?`
        : (REPLIES[((id - 1) / 2) % REPLIES.length] ?? ""),
    status: "complete" as const,
  }))

@Component({
  selector: "app-chat",
  imports: [MessageThread, PromptInput, StreamingMessage],
  template: `
    <!-- The thread and its composer share one column, so their edges line up in every skin. -->
    <div style="display: grid; gap: 12px; inline-size: min(100%, 560px)">
      <div rindMessageThreadRoot class="thread" [count]="list().length" [lastFromUser]="lastFromUser()">
        <div rindMessageThreadViewport>
          @for (m of list(); track m.id; let i = $index) {
            <div rindMessageThreadMessage [index]="i" [from]="m.from">
              @if (m.from === "assistant") {
                <div
                  rindStreamingMessageRoot
                  [text]="m.text"
                  [status]="m.status"
                  [announce]="i === list().length - 1 ? 'status' : 'none'"
                >
                  <div rindStreamingMessageContent></div>
                  <span rindStreamingMessageCaret></span>
                </div>
              } @else {
                {{ m.text }}
              }
            </div>
          }
        </div>
        <button rindMessageThreadJumpToLatest></button>
      </div>
      <!-- rind-ui's Prompt Input: full width under the thread; Stop cancels the streaming answer. -->
      <form rindPromptInputRoot [status]="busy() ? 'streaming' : 'idle'" [submitHandler]="ask" (stop)="stop()">
        <label rindPromptInputLabel>Message</label>
        <textarea rindPromptInputTextarea placeholder="Ask about the thread"></textarea>
        <button rindPromptInputSubmit>
          @if (busy()) {
            <svg aria-hidden="true" viewBox="0 0 256 256" width="14" height="14" fill="currentColor">
              <rect x="40" y="40" width="176" height="176" rx="24" />
            </svg>
          } @else {
            <svg aria-hidden="true" viewBox="0 0 256 256" width="18" height="18" fill="currentColor"><path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z" /></svg>
          }
        </button>
      </form>
    </div>
  `,
})
export class Chat {
  // A fake chat: the answer streams in bursts after each question.
  readonly list = signal<Msg[]>(history(8))
  private timer: ReturnType<typeof setTimeout> | null = null
  readonly busy = computed(() =>
    this.list().some((m) => m.status === "pending" || m.status === "streaming"),
  )
  readonly lastFromUser = computed(
    () => this.list().at(-1)?.from === "user" || this.list().at(-2)?.from === "user",
  )

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer)
    })
  }

  readonly ask = ({ text }: { text: string }) => {
    const base = this.list().length
    const reply = REPLIES[(base / 2) % REPLIES.length] ?? ""
    this.list.update((l) => [
      ...l,
      { id: base, from: "user", text, status: "complete" },
      { id: base + 1, from: "assistant", text: "", status: "pending" },
    ])
    const words = reply.split(/(?<= )/)
    let i = 0
    const step = () => {
      i = Math.min(words.length, i + 1 + Math.floor(Math.random() * 6))
      const done = i >= words.length
      this.list.update((l) =>
        l.map((m) =>
          m.id === base + 1
            ? { ...m, text: words.slice(0, i).join(""), status: done ? "complete" : "streaming" }
            : m,
        ),
      )
      if (!done) this.timer = setTimeout(step, 80 + Math.random() * 160)
    }
    this.timer = setTimeout(step, 300)
  }

  stop() {
    if (this.timer) clearTimeout(this.timer)
    this.list.update((l) =>
      l.map((m) =>
        m.status === "pending" || m.status === "streaming" ? { ...m, status: "cancelled" } : m,
      ),
    )
  }
}
