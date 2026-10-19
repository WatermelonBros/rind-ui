"use client"

import {
  type PromptAttachment,
  PromptInput,
  type PromptInputRootProps,
  usePromptInput,
} from "@rind-ui/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = {
  "prompt-input": { idle: "Basic", submitting: "Submitting", streaming: "Streaming" },
}

/** Glyphs drawn inline, so every skin shows them (the theme draws its own when empty). */
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
const Paperclip = () => (
  <svg aria-hidden="true" viewBox="0 0 256 256" width="18" height="18" fill="currentColor">
    <path d="M209.66,122.34a8,8,0,0,1,0,11.32l-82.05,82a56,56,0,0,1-79.2-79.21L147.67,35.73a40,40,0,1,1,56.61,56.55L105,193A24,24,0,1,1,71,159L154.3,74.38A8,8,0,1,1,165.7,85.6L82.39,170.31a8,8,0,1,0,11.27,11.36L192.93,81A24,24,0,1,0,159,47L59.76,147.68a40,40,0,1,0,56.53,56.62l82.06-82A8,8,0,0,1,209.66,122.34Z" />
  </svg>
)

/** Send arrow while idle, stop square while a reply is on its way. */
function SubmitGlyph() {
  const { state } = usePromptInput()
  return state === "submitting" || state === "streaming" || state === "stopped" ? (
    <Square />
  ) : (
    <ArrowUp />
  )
}

/** The composer: attachments, the draft, then attach, the count and Submit on one row. */
function Composer({
  label = "Message",
  placeholder = "Ask anything",
  count,
  description,
  ...root
}: Omit<PromptInputRootProps, "children"> & {
  readonly label?: string
  readonly placeholder?: string
  readonly count?: { readonly max: number; readonly count?: (value: string) => number }
  readonly description?: ReactNode
}) {
  return (
    <PromptInput.Root {...root}>
      <PromptInput.Label>{label}</PromptInput.Label>
      <PromptInput.Attachments />
      <PromptInput.Textarea placeholder={placeholder} />
      {description ? <PromptInput.Description>{description}</PromptInput.Description> : null}
      <PromptInput.AttachTrigger>
        <Paperclip />
      </PromptInput.AttachTrigger>
      {count ? <PromptInput.CharacterCount {...count} /> : null}
      <PromptInput.Submit>
        <SubmitGlyph />
      </PromptInput.Submit>
    </PromptInput.Root>
  )
}

export function Basic() {
  return <Composer onSubmit={() => {}} />
}

interface Turn {
  readonly id: number
  readonly role: "user" | "assistant"
  readonly text: string
  readonly files?: readonly string[]
}

const REPLY =
  "Here is a short answer, streamed word by word. Press the stop button to end it early."

/** A whole chat turn without a model: the reply is a local stream the stop button can end. */
export function Chat() {
  const [turns, setTurns] = useState<readonly Turn[]>([])
  const [status, setStatus] = useState<"idle" | "submitting" | "streaming">("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const next = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const stream = (id: number, words: readonly string[], i: number) => {
    timer.current = setTimeout(() => {
      setTurns((all) =>
        all.map((t) => (t.id === id ? { ...t, text: words.slice(0, i + 1).join(" ") } : t)),
      )
      if (i + 1 < words.length) stream(id, words, i + 1)
      else setStatus("idle")
    }, 90)
  }
  return (
    <div className="chat">
      <ol className="chat-log" aria-label="Conversation">
        {turns.map((t) => (
          <li key={t.id} data-role={t.role}>
            {t.files?.length ? <span className="chat-files">{t.files.join(", ")}</span> : null}
            {t.text}
          </li>
        ))}
      </ol>
      <Composer
        status={status}
        onSubmit={({ text, attachments }) => {
          const user = next.current++
          const reply = next.current++
          setTurns((all) => [
            ...all,
            { id: user, role: "user", text, files: attachments.map((a) => a.name) },
            { id: reply, role: "assistant", text: "" },
          ])
          setStatus("submitting")
          timer.current = setTimeout(() => {
            setStatus("streaming")
            stream(reply, REPLY.split(" "), 0)
          }, 400)
        }}
        onStop={() => {
          clearTimeout(timer.current)
          setStatus("idle")
        }}
      />
    </div>
  )
}

export function Submitting() {
  return <Composer status="submitting" defaultValue="Next question" onStop={() => {}} />
}

export function Streaming() {
  return <Composer status="streaming" onStop={() => {}} />
}

const sample: readonly PromptAttachment[] = [
  { id: "brief", name: "brief.pdf", type: "application/pdf", size: 182_000 },
  { id: "chart", name: "q3-chart.png", type: "image/png", size: 64_000 },
  { id: "notes", name: "notes.txt", type: "text/plain", size: 2_000, pending: true },
]

export function Attachments() {
  const [rejected, setRejected] = useState("")
  return (
    <div className="stack">
      <Composer
        defaultAttachments={sample}
        accept="image/*,.pdf,.txt,.md"
        maxFiles={5}
        maxFileSize={5_000_000}
        onSubmit={() => {}}
        onReject={(r) => setRejected(r.map((x) => `${x.file.name} (${x.reason})`).join(", "))}
        placeholder="Drop or paste files, or use the paperclip"
      />
      <span className="note">refused: {rejected || "nothing yet"}</span>
    </div>
  )
}

/** A rough token count (words), standing in for a real tokenizer. */
const words = (value: string) => value.split(/\s+/).filter(Boolean).length

export function TokenLimit() {
  return (
    <Composer
      label="Prompt (up to 12 words)"
      count={{ max: 12, count: words }}
      defaultValue="Summarise the attached report in three short bullet points please"
      onSubmit={() => {}}
    />
  )
}

export function History() {
  return (
    <Composer
      history={["What is a headless component?", "Show me an example with a form"]}
      description="Press the up arrow in the empty box to recall a previous prompt."
      onSubmit={() => {}}
    />
  )
}

export function ModEnter() {
  return (
    <Composer
      submitKey="mod+enter"
      description="Enter adds a line; Ctrl+Enter (⌘+Enter on a Mac) sends."
      onSubmit={() => {}}
    />
  )
}

export function Disabled() {
  return <Composer disabled defaultValue="Waiting for the connection" />
}

export function Rtl() {
  return (
    <div dir="rtl">
      <Composer label="رسالة" placeholder="اسأل أي شيء" onSubmit={() => {}} />
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Default",
    description: "Enter sends, Shift+Enter adds a line; the box grows with the text.",
  },
  Chat: {
    title: "A chat turn",
    description:
      "`status` walks submitting → streaming → idle; Submit becomes Stop and back without losing focus.",
  },
  Submitting: {
    title: "Submitting",
    description: "Waiting for the reply: the draft stays editable, Submit stops.",
  },
  Streaming: { title: "Streaming", description: "The reply is arriving: Submit stops it." },
  Attachments: {
    title: "Attachments",
    description:
      "Picker, paste and drop; `accept`, `maxFiles` and `maxFileSize` refuse files with a reason. A pending upload blocks sending.",
  },
  TokenLimit: {
    title: "Token limit",
    description: "`CharacterCount` with a `count` function; over the limit nothing is sent.",
  },
  History: { title: "History", description: "`history` recalls past prompts with ArrowUp." },
  ModEnter: {
    title: "Ctrl+Enter to send",
    description: '`submitKey="mod+enter"`: Enter is a newline, for IME-heavy writing.',
  },
  Disabled: { title: "Disabled", description: "Every part is disabled." },
  Rtl: { title: "Right to left", description: "The row mirrors; keys follow `dir`." },
}
