"use client"

import type { MentionsQuery } from "@rind-ui/core"
import { Mentions } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { mentions: { closed: "Basic" } }

const people = [
  { id: "ada", name: "Ada Lovelace" },
  { id: "alan", name: "Alan Turing" },
  { id: "grace", name: "Grace Hopper" },
  { id: "katherine", name: "Katherine Johnson" },
]
const commands = [
  { id: "summarize", name: "summarize" },
  { id: "translate", name: "translate" },
  { id: "explain", name: "explain" },
]

export function Basic() {
  const [query, setQuery] = useState<MentionsQuery | null>(null)
  const [ran, setRan] = useState<string | null>(null)
  const options = query?.trigger === "/" ? commands : people
  return (
    <div className="stack mentions-demo">
      <label htmlFor="mentions-comment">Comment</label>
      <Mentions.Root
        triggers={[{ char: "@" }, { char: "/", behavior: "action", startOfInput: true }]}
        onQueryChange={setQuery}
        onSelect={({ key }) => setRan(key)}
      >
        <Mentions.Highlighter />
        <Mentions.Textarea
          id="mentions-comment"
          rows={3}
          placeholder="Type @ to mention, / for a command"
        />
        <Mentions.Description />
        <Mentions.Positioner>
          <Mentions.Popup>
            <Mentions.List>
              {options.map((o) => (
                <Mentions.Item key={o.id} value={o.id}>
                  <Mentions.ItemText>{o.name}</Mentions.ItemText>
                </Mentions.Item>
              ))}
            </Mentions.List>
            <Mentions.Empty>No match</Mentions.Empty>
          </Mentions.Popup>
        </Mentions.Positioner>
      </Mentions.Root>
      <p className="note" aria-live="polite">
        {ran ? `Ran /${ran}` : " "}
      </p>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Comment box",
    description:
      "@ opens people (Enter or Tab inserts), / at the start runs a command. Backspace at a mention's end removes it whole.",
  },
}
