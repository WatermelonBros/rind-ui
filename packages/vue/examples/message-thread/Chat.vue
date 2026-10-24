<script setup lang="ts">
import { MessageThread, PromptInput, StreamingMessage } from "@rind-ui/vue"
import { computed, onBeforeUnmount, ref } from "vue"

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

// A fake chat: the answer streams in bursts after each question.
const list = ref<Msg[]>(history(8))
let timer: ReturnType<typeof setTimeout> | null = null
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
const ask = (question: string) => {
  const base = list.value.length
  const reply = REPLIES[(base / 2) % REPLIES.length] ?? ""
  list.value = [
    ...list.value,
    { id: base, from: "user", text: question, status: "complete" },
    { id: base + 1, from: "assistant", text: "", status: "pending" },
  ]
  const words = reply.split(/(?<= )/)
  let i = 0
  const step = () => {
    i = Math.min(words.length, i + 1 + Math.floor(Math.random() * 6))
    const done = i >= words.length
    list.value = list.value.map((m) =>
      m.id === base + 1
        ? { ...m, text: words.slice(0, i).join(""), status: done ? "complete" : "streaming" }
        : m,
    )
    if (!done) timer = setTimeout(step, 80 + Math.random() * 160)
  }
  timer = setTimeout(step, 300)
}
const busy = computed(() =>
  list.value.some((m) => m.status === "pending" || m.status === "streaming"),
)
const stop = () => {
  if (timer) clearTimeout(timer)
  list.value = list.value.map((m) =>
    m.status === "pending" || m.status === "streaming" ? { ...m, status: "cancelled" } : m,
  )
}
const lastFromUser = computed(
  () => list.value.at(-1)?.from === "user" || list.value.at(-2)?.from === "user",
)
</script>

<template>
  <!-- The thread and its composer share one column, so their edges line up in every skin. -->
  <div :style="{ display: 'grid', gap: '12px', inlineSize: 'min(100%, 560px)' }">
    <MessageThread.Root class="thread" :count="list.length" :last-from-user="lastFromUser">
      <MessageThread.Viewport>
        <MessageThread.Message v-for="(m, i) in list" :key="m.id" :index="i" :from="m.from">
          <StreamingMessage.Root
            v-if="m.from === 'assistant'"
            :text="m.text"
            :status="m.status"
            :announce="i === list.length - 1 ? 'status' : 'none'"
          >
            <StreamingMessage.Content />
            <StreamingMessage.Caret />
          </StreamingMessage.Root>
          <template v-else>{{ m.text }}</template>
        </MessageThread.Message>
      </MessageThread.Viewport>
      <MessageThread.JumpToLatest />
    </MessageThread.Root>
    <!-- rind-ui's Prompt Input: full width under the thread; Stop cancels the streaming answer. -->
    <PromptInput.Root
      :status="busy ? 'streaming' : 'idle'"
      :on-submit="({ text }: { text: string }) => ask(text)"
      :on-stop="stop"
    >
      <PromptInput.Label>Message</PromptInput.Label>
      <PromptInput.Textarea placeholder="Ask about the thread" />
      <PromptInput.Submit>
        <svg v-if="busy" aria-hidden="true" viewBox="0 0 256 256" width="14" height="14" fill="currentColor">
          <rect x="40" y="40" width="176" height="176" rx="24" />
        </svg>
        <svg v-else aria-hidden="true" viewBox="0 0 256 256" width="18" height="18" fill="currentColor">
          <path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z" />
        </svg>
      </PromptInput.Submit>
    </PromptInput.Root>
  </div>
</template>
