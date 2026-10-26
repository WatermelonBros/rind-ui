"use client"

import { PromptInput, Suggestions } from "@rind-ui/react"
import { useRef, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = {
  suggestions: { ready: "Basic", loading: "Loading", disabled: "Disabled" },
}

const STARTERS = [
  { label: "Summarise", value: "Summarise this thread in three bullet points" },
  { label: "Draft a reply", description: "Polite, two paragraphs" },
  { label: "Find action items" },
]

function Chips({
  loading = false,
  disabled = false,
  onSelect,
}: {
  loading?: boolean
  disabled?: boolean
  onSelect?: (value: string) => void
}) {
  return (
    <Suggestions.Root
      loading={loading}
      disabled={disabled}
      onSelect={({ value }) => onSelect?.(value)}
    >
      {STARTERS.map((s) => (
        <Suggestions.Item key={s.label} {...(s.value ? { value: s.value } : {})}>
          <Suggestions.Label>{s.label}</Suggestions.Label>
          {s.description && <Suggestions.Description>{s.description}</Suggestions.Description>}
        </Suggestions.Item>
      ))}
    </Suggestions.Root>
  )
}

export function Basic() {
  const [picked, setPicked] = useState("")
  return (
    <div className="stack">
      <Chips onSelect={setPicked} />
      <p aria-live="off">Picked: {picked || "nothing yet"}</p>
    </div>
  )
}

export function Loading() {
  return <Chips loading />
}

export function Disabled() {
  return <Chips disabled />
}

export function WithPrompt() {
  const [draft, setDraft] = useState("")
  const input = useRef<HTMLTextAreaElement>(null)
  return (
    <div className="stack">
      <Suggestions.Root onSelect={({ value }) => setDraft(value)} focusTarget={() => input.current}>
        {STARTERS.map((s) => (
          <Suggestions.Item key={s.label} {...(s.value ? { value: s.value } : {})}>
            <Suggestions.Label>{s.label}</Suggestions.Label>
          </Suggestions.Item>
        ))}
      </Suggestions.Root>
      <PromptInput.Root value={draft} onValueChange={setDraft} onSubmit={() => setDraft("")}>
        <PromptInput.Label>Message</PromptInput.Label>
        <PromptInput.Textarea ref={input} />
        <PromptInput.Submit>Send</PromptInput.Submit>
      </PromptInput.Root>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Starter prompts",
    description: "A press hands the value to you; the component sends nothing itself.",
  },
  Loading: {
    title: "While the answer streams",
    description: "The chips stay, disabled but focusable; the group is busy.",
  },
  Disabled: {
    title: "Disabled",
    description: "The whole group is disabled: the chips stay visible, a press does nothing.",
  },
  WithPrompt: {
    title: "Into the prompt",
    description:
      "The suggestion fills the prompt and the focus moves there when the press began inside.",
  },
}
