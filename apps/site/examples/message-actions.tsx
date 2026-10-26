"use client"

import { MessageActions } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "message-actions": { live: "Basic" } }

/** Phosphor (regular) icons; the buttons are named by the component, not by these. */
function Icon({ d }: { readonly d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" width="16" height="16" fill="currentColor">
      <path d={d} />
    </svg>
  )
}
const COPY =
  "M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"
const REDO =
  "M240,56v48a8,8,0,0,1-8,8H184a8,8,0,0,1,0-16H211.4L184.81,71.64l-.25-.24a80,80,0,1,0-1.67,114.78,8,8,0,0,1,11,11.63A95.44,95.44,0,0,1,128,224h-1.32A96,96,0,1,1,195.75,60L224,85.8V56a8,8,0,1,1,16,0Z"
const EDIT =
  "M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"
const UP =
  "M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32ZM223.94,97l-12,96a8,8,0,0,1-7.94,7H88V105.89l36.71-73.43A24,24,0,0,1,144,56V80a8,8,0,0,0,8,8h64a8,8,0,0,1,7.94,9Z"
const DOWN =
  "M239.82,157l-12-96A24,24,0,0,0,204,40H32A16,16,0,0,0,16,56v88a16,16,0,0,0,16,16H75.06l37.78,75.58A8,8,0,0,0,120,240a40,40,0,0,0,40-40V184h56a24,24,0,0,0,23.82-27ZM72,144H32V56H72Zm150,21.29a7.88,7.88,0,0,1-6,2.71H152a8,8,0,0,0-8,8v24a24,24,0,0,1-19.29,23.54L88,150.11V56H204a8,8,0,0,1,7.94,7l12,96A7.87,7.87,0,0,1,222,165.29Z"

const VERSIONS = [
  "Rind is a set of headless components: behaviour and accessibility, no styles.",
  "Rind gives you the behaviour, keyboard and accessibility of each component; the look is yours.",
  "Headless components for five frameworks, with drivers to test them.",
]

export function Basic() {
  const [index, setIndex] = useState(1)
  const [rating, setRating] = useState<string | null>(null)
  const regenerate = () => new Promise<void>((r) => setTimeout(r, 1200))
  return (
    <article className="message" aria-label="Assistant message">
      <p>{VERSIONS[index]}</p>
      <MessageActions.Root
        active
        onRegenerate={regenerate}
        count={VERSIONS.length}
        index={index}
        onIndexChange={setIndex}
      >
        <MessageActions.Copy value={() => VERSIONS[index] ?? ""}>
          <Icon d={COPY} />
        </MessageActions.Copy>
        <MessageActions.Regenerate>
          <Icon d={REDO} />
        </MessageActions.Regenerate>
        <MessageActions.Feedback
          value={rating ? [rating] : []}
          onValueChange={(v) => setRating(v[0] ?? null)}
        >
          <MessageActions.FeedbackItem value="up">
            <Icon d={UP} />
          </MessageActions.FeedbackItem>
          <MessageActions.FeedbackItem value="down">
            <Icon d={DOWN} />
          </MessageActions.FeedbackItem>
        </MessageActions.Feedback>
        <MessageActions.Versions>
          <MessageActions.VersionPrevious>‹</MessageActions.VersionPrevious>
          <MessageActions.VersionStatus />
          <MessageActions.VersionNext>›</MessageActions.VersionNext>
        </MessageActions.Versions>
      </MessageActions.Root>
    </article>
  )
}

export function OnHover() {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("Hover this message, or Tab into it: its actions appear.")
  return (
    <article className="message" aria-label="Your message">
      {editing ? (
        <textarea
          aria-label="Edit message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setEditing(false)}
          // biome-ignore lint/a11y/noAutofocus: the editor opens from the user's own press
          autoFocus
        />
      ) : (
        <p>{text}</p>
      )}
      <MessageActions.Root editing={editing} onEditingChange={setEditing}>
        <MessageActions.Copy value={() => text}>
          <Icon d={COPY} />
        </MessageActions.Copy>
        <MessageActions.Edit>
          <Icon d={EDIT} />
        </MessageActions.Edit>
      </MessageActions.Root>
    </article>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Assistant message",
    description:
      'Copy, regenerate (busy until done, no double press), thumbs, and versions that announce "Version 2 of 3". One Tab stop for the row.',
  },
  OnHover: {
    title: "Shown on hover and focus",
    description:
      "Hidden by style, never unmounted: the focus never drops. Edit returns the focus when the editor closes.",
  },
}
