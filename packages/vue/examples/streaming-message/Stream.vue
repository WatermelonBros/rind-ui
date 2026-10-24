<script setup lang="ts">
import { Button, StreamingMessage } from "@rind-ui/vue"
import { onBeforeUnmount, ref } from "vue"

const ANSWER =
  "A headless component owns behaviour and accessibility, and leaves the look to you. " +
  "This one paces bursty chunks so they read evenly, marks the text busy while it grows, " +
  "and announces the start and the end of the response, never each chunk.\n\n" +
  "Your renderer gets the displayed text: plain, markdown, anything."

type Status = "pending" | "streaming" | "complete" | "cancelled" | "error"

// A fake model: bursts of 1 to 12 words every 60 to 240 ms.
const text = ref("")
const status = ref<Status>("pending")
let timer: ReturnType<typeof setTimeout> | null = null
const stop = (next: Status) => {
  if (timer) clearTimeout(timer)
  timer = null
  status.value = next
}
const start = (fail = false) => {
  if (timer) clearTimeout(timer)
  const words = ANSWER.split(/(?<= )/)
  let i = 0
  text.value = ""
  status.value = "streaming"
  const step = () => {
    i = Math.min(words.length, i + 1 + Math.floor(Math.random() * 12))
    text.value = words.slice(0, i).join("")
    if (fail && i > words.length / 2) return stop("error")
    if (i >= words.length) return stop("complete")
    timer = setTimeout(step, 60 + Math.random() * 180)
  }
  timer = setTimeout(step, 400)
}
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div :style="{ display: 'grid', gap: '16px', inlineSize: 'min(100%, 560px)' }">
    <StreamingMessage.Root role="article" aria-label="Assistant" :text="text" :status="status">
      <StreamingMessage.Content />
      <StreamingMessage.Caret />
    </StreamingMessage.Root>
    <div :style="{ display: 'flex', flexWrap: 'wrap', gap: '8px' }">
      <Button :disabled="status === 'streaming'" @press="start()">
        {{ status === "pending" ? "Ask" : "Ask again" }}
      </Button>
      <Button :disabled="status !== 'streaming'" @press="stop('cancelled')">Stop</Button>
      <Button :disabled="status === 'streaming'" @press="start(true)">Ask and fail</Button>
    </div>
  </div>
</template>
