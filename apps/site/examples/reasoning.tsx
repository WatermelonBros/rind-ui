"use client"

import { Button, Reasoning, type ReasoningRootProps, StreamingMessage } from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import type { States, Variants } from "./types"

/** `closing` lasts the second before the automatic close: reached by the Live example. */
/** Inline layout: theme pages do not load the site's helper classes. */
const STACK = { display: "grid", gap: 16, inlineSize: "min(100%, 560px)" } as const
const ROW = { display: "flex", flexWrap: "wrap", gap: 8 } as const

export const states: States = { reasoning: { done: "Done", thinking: "Thinking" } }

const TRACE =
  "The user asks why the sea has tides. The moon's gravity pulls the near side of the ocean more than the far side, so the water bulges on both sides. The Earth turns under the two bulges, which gives two high tides a day. The sun adds a smaller pull: spring tides when they line up, neap tides when they are at right angles."
const ANSWER =
  "Mostly the moon: its pull stretches the oceans into two bulges, and the Earth turns under them, so most coasts get two high tides a day. The sun's smaller pull makes them larger (spring) or smaller (neap) through the month."

/** A fake model: it thinks (the trace grows), then answers. */
function useModel() {
  const [trace, setTrace] = useState("")
  const [answer, setAnswer] = useState("")
  const [phase, setPhase] = useState<"idle" | "thinking" | "answering" | "done">("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const run = () => {
    if (timer.current) clearTimeout(timer.current)
    setTrace("")
    setAnswer("")
    setPhase("thinking")
    const t = TRACE.split(/(?<= )/)
    const a = ANSWER.split(/(?<= )/)
    let i = 0
    let j = 0
    const think = () => {
      i = Math.min(t.length, i + 2)
      setTrace(t.slice(0, i).join(""))
      if (i < t.length) {
        timer.current = setTimeout(think, 110)
        return
      }
      setPhase("answering")
      const speak = () => {
        j = Math.min(a.length, j + 3)
        setAnswer(a.slice(0, j).join(""))
        if (j < a.length) timer.current = setTimeout(speak, 90)
        else setPhase("done")
      }
      timer.current = setTimeout(speak, 200)
    }
    timer.current = setTimeout(think, 300)
  }
  return { trace, answer, phase, run }
}

export function Live() {
  const { trace, answer, phase, run } = useModel()
  return (
    <div style={STACK}>
      {phase === "idle" ? null : (
        <>
          <Reasoning.Root thinking={phase === "thinking"}>
            <Reasoning.Trigger />
            <Reasoning.Content>{trace}</Reasoning.Content>
          </Reasoning.Root>
          <StreamingMessage.Root
            text={answer}
            status={phase === "done" ? "complete" : phase === "answering" ? "streaming" : "pending"}
            announce="none"
          >
            <StreamingMessage.Content />
          </StreamingMessage.Root>
        </>
      )}
      <div style={ROW}>
        <Button onPress={run} disabled={phase === "thinking" || phase === "answering"}>
          Why are there tides?
        </Button>
      </div>
    </div>
  )
}

function Fixed(props: Partial<ReasoningRootProps>) {
  return (
    <Reasoning.Root thinking={false} {...props}>
      <Reasoning.Trigger />
      <Reasoning.Content>{TRACE}</Reasoning.Content>
    </Reasoning.Root>
  )
}

export function Done() {
  return <Fixed duration={12} />
}

export function Thinking() {
  return <Fixed thinking defaultOpen />
}

export function CustomTrigger() {
  return (
    <Reasoning.Root thinking={false} duration={8}>
      <Reasoning.Trigger
        render={(props, { duration, open }) => (
          <button {...props}>
            {open ? "Hide" : "Show"} the reasoning ({duration ?? "?"} s)
          </button>
        )}
      />
      <Reasoning.Content>{TRACE}</Reasoning.Content>
    </Reasoning.Root>
  )
}

export const variants: Variants = {
  Live: {
    title: "Live",
    description:
      'Opens by itself while the model thinks ("Thinking…"), closes a second after it answers ("Thought for N seconds"), unless you toggled it or your focus is inside.',
    motion: "keep",
  },
  Done: {
    title: "Done",
    description: "A reloaded message: closed, silent, with the runtime's duration.",
  },
  Thinking: {
    title: "Thinking",
    description: "While the model thinks: busy content, shimmering trigger.",
  },
  CustomTrigger: {
    title: "Your trigger text",
    description: "The render state carries `open`, `thinking` and `duration`.",
  },
}
