"use client"

import { Dialog, Popover } from "@rind-ui/react"
import type { ReactNode } from "react"
import type { Variants } from "../types"

/** A non-modal popover with a title, a description and an arrow. */
function Panel({
  label,
  title,
  children,
  defaultOpen,
}: {
  label: string
  title: string
  children?: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <Popover.Root {...(defaultOpen ? { defaultOpen } : {})}>
      <Popover.Trigger>{label}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Title>{title}</Popover.Title>
            {children ?? <Popover.Description>Details about {label}.</Popover.Description>}
            <Popover.CloseTrigger>Close</Popover.CloseTrigger>
            <Popover.Arrow />
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** A popover opened from inside a modal dialog: the dialog is its parent layer. */
export function InDialog() {
  return (
    <Dialog.Root defaultOpen>
      <Dialog.Trigger>Settings</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Settings</Dialog.Title>
            <Panel label="Help" title="About settings" />
            <Dialog.CloseTrigger>Done</Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Two sibling popovers: opening one closes the other through the outside press. */
export function Siblings() {
  return (
    <div className="row">
      <Panel label="First" title="First panel" />
      <Panel label="Second" title="Second panel" />
    </div>
  )
}

/** Content taller and wider than a 320 px viewport: clamped to the available size, scrolling. */
export function LongContentStory() {
  return (
    <Panel label="Terms" title="Terms of use" defaultOpen>
      {/* the text scrolls inside the clamped panel; the arrow stays outside the scroller */}
      <section
        aria-label="Terms text"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
        tabIndex={0}
        style={{
          display: "grid",
          gap: 10,
          overflowY: "auto",
          maxHeight: "calc(var(--rind-available-height, 60vh) - 140px)",
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static filler paragraphs
          <p key={i}>
            Paragraph {i + 1}: the panel is clamped to the viewport and its content scrolls, so the
            close button stays reachable on a small screen.
          </p>
        ))}
      </section>
    </Panel>
  )
}

/** Right-to-left: logical sides and the Tab order follow the direction. */
export function Rtl() {
  return (
    <div dir="rtl" className="row">
      <Popover.Root positioning={{ side: "inline-end" }} defaultOpen>
        <Popover.Trigger>خيارات</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Title>الخيارات</Popover.Title>
              <Popover.Description>تظهر هذه اللوحة على الجانب المنطقي للنهاية.</Popover.Description>
              <Popover.CloseTrigger>إغلاق</Popover.CloseTrigger>
              <Popover.Arrow />
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

/** Real motion: the content stays mounted while it exits (`data-state="closed"`). */
export function ExitAnimation() {
  return <Panel label="Animated" title="Animated panel" />
}

/** The driver opens and closes the popover the way a user would. */
export function DriverExample() {
  return <Panel label="Share" title="Share this page" />
}

export const variants: Variants = {
  InDialog: { title: "In a dialog", hidden: true, motion: "keep" },
  Siblings: { title: "Sibling popovers", hidden: true },
  LongContentStory: { title: "Long content", hidden: true, viewport: "mobile" },
  Rtl: { title: "Right to left", hidden: true },
  ExitAnimation: { title: "Exit animation", hidden: true, motion: "keep" },
  DriverExample: { title: "Driver example", hidden: true },
}
