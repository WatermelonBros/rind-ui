"use client"

import { ScrollArea, type ScrollAreaRootProps } from "@rind-ui/react"
import type { ReactNode } from "react"
import type { States, Variants } from "./types"

// The other states (engaged, lingering, dragging) are transient: hover, focus or drag one.
export const states: States = { "scroll-area": { idle: "Basic" } }

const notes = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => `Release ${n - i}: faster builds, smaller bundles and fewer surprises.`,
  ).map((text) => <p key={text}>{text}</p>)

function Area({
  label,
  children,
  horizontal = false,
  vertical = true,
  ...props
}: ScrollAreaRootProps & {
  readonly label: string
  readonly children: ReactNode
  readonly horizontal?: boolean
  readonly vertical?: boolean
}) {
  return (
    <ScrollArea.Root {...props}>
      <ScrollArea.Viewport aria-label={label}>
        <ScrollArea.Content>{children}</ScrollArea.Content>
      </ScrollArea.Viewport>
      {vertical && (
        <ScrollArea.Scrollbar>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      )}
      {horizontal && (
        <ScrollArea.Scrollbar orientation="horizontal">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      )}
      {horizontal && vertical && <ScrollArea.Corner />}
    </ScrollArea.Root>
  )
}

export function Basic() {
  return <Area label="Release notes">{notes(20)}</Area>
}

export function Horizontal() {
  return (
    <Area label="Tags" horizontal vertical={false} data-shape="strip">
      <div className="row" style={{ flexWrap: "nowrap", inlineSize: "max-content" }}>
        {["design", "react", "a11y", "headless", "theme", "testing", "docs", "rtl", "forms"].map(
          (t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ),
        )}
      </div>
    </Area>
  )
}

export function BothAxes() {
  return (
    <Area label="Wide table" horizontal>
      <div style={{ inlineSize: 720 }}>{notes(20)}</div>
    </Area>
  )
}

export function Types() {
  return (
    <div className="row" style={{ alignItems: "flex-start" }}>
      {(["hover", "scroll", "auto", "always"] as const).map((type) => (
        <div key={type} className="stack">
          <code>{type}</code>
          <Area label={`Type ${type}`} type={type} data-shape="small">
            {notes(10)}
          </Area>
        </div>
      ))}
    </div>
  )
}

export function FadeMask() {
  return (
    <Area label="Faded notes" data-fade="">
      {notes(20)}
    </Area>
  )
}

export function ChatLog() {
  return (
    <ScrollArea.Root>
      <ScrollArea.Viewport
        aria-label="Chat"
        style={{ display: "flex", flexDirection: "column-reverse" }}
      >
        <ScrollArea.Content>
          {Array.from({ length: 20 }, (_, i) =>
            i % 2 ? `Ada: message ${i + 1}` : `Alan: reply ${i + 1}`,
          ).map((text) => (
            <p key={text}>{text}</p>
          ))}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}

export function RightToLeft() {
  return (
    <div dir="rtl" lang="ar">
      <Area label="ملاحظات الإصدار" horizontal>
        <div style={{ inlineSize: 720 }}>
          {Array.from({ length: 20 }, (_, i) => `الإصدار ${20 - i}: بناء أسرع وحزم أصغر.`).map(
            (text) => (
              <p key={text}>{text}</p>
            ),
          )}
        </div>
      </Area>
    </div>
  )
}

export function ButtonList() {
  return (
    <ScrollArea.Root>
      <ScrollArea.Viewport>
        <ScrollArea.Content className="stack">
          {Array.from({ length: 15 }, (_, i) => `Open file ${i + 1}`).map((text) => (
            <button key={text} type="button">
              {text}
            </button>
          ))}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}

export function Nested() {
  return (
    <Area label="Outer notes">
      {notes(4)}
      <Area label="Inner notes" data-shape="small">
        {notes(10)}
      </Area>
      {notes(10)}
    </Area>
  )
}

export function Snap() {
  return (
    <ScrollArea.Root>
      <ScrollArea.Viewport aria-label="Photos" style={{ scrollSnapType: "y mandatory" }}>
        <ScrollArea.Content>
          {["Lake", "Hills", "Coast", "Forest", "Desert", "City"].map((name) => (
            <p key={name} className="snap-card">
              {name}
            </p>
          ))}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description:
      "Native scrolling with a custom thumb. Text-only content makes the Viewport a tab stop.",
  },
  Horizontal: { title: "Horizontal", description: '`orientation="horizontal"` on the Scrollbar.' },
  BothAxes: { title: "Both axes", description: "Two Scrollbars and the Corner between them." },
  Types: {
    title: "Visibility types",
    description: "`hover` (default), `scroll`, `auto` and `always`.",
  },
  FadeMask: {
    title: "Fade masks",
    description:
      "`data-overflow-y-start` / `-end` and their distances fade the edges with content.",
  },
  ChatLog: {
    title: "Chat log",
    description: "`column-reverse`: starts at the bottom; the thumb starts there too.",
  },
  RightToLeft: {
    title: "Right to left",
    description: "The thumb and the bar mirror on their own.",
  },
  ButtonList: {
    title: "List of buttons",
    description: "Focusable content: no extra tab stop; arrow keys on a button scroll.",
  },
  Nested: { title: "Nested", description: "Each area measures and drags only its own parts." },
  Snap: {
    title: "Scroll snap",
    description: "Dragging turns snapping off; it resumes on release.",
  },
}
