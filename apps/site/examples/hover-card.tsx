"use client"

import { HoverCard, type HoverCardRootProps } from "@rind-ui/react"
import type { States, Variants } from "./types"

export const states: States = { "hover-card": { closed: "Basic", open: "Open" } }

/** A profile link and its preview: the parts every example repeats. */
function Profile({
  name = "Ada Lovelace",
  ...root
}: HoverCardRootProps & { readonly name?: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
  return (
    <div>
      Notes by{" "}
      <HoverCard.Root {...root}>
        <HoverCard.Trigger href="#profile">{name}</HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Positioner>
            <HoverCard.Content>
              <div className="profile-card">
                <span className="profile-avatar" aria-hidden="true">
                  {initials}
                </span>
                <div>
                  <strong>{name}</strong>
                  <p>Wrote the first published algorithm. 1,815 followers.</p>
                </div>
              </div>
              <HoverCard.Arrow />
            </HoverCard.Content>
          </HoverCard.Positioner>
        </HoverCard.Portal>
      </HoverCard.Root>{" "}
      on the analytical engine.
    </div>
  )
}

export function Basic() {
  return <Profile />
}

export function Open() {
  return <Profile defaultOpen />
}

export function Delays() {
  return (
    <div className="stack">
      <Profile name="Grace Hopper" openDelay={150} closeDelay={150} />
      <Profile name="Alan Turing" openDelay={1200} />
    </div>
  )
}

export function Placement() {
  return <Profile name="Hedy Lamarr" positioning={{ side: "top" }} />
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description:
      "Rest the pointer on the link, or Tab to it and wait. The link still navigates; the card only previews it.",
  },
  Delays: {
    title: "Delays",
    description: "`openDelay` and `closeDelay`, in milliseconds: quick, then deliberately slow.",
  },
  Placement: { title: "Placement", description: '`positioning={{ side: "top" }}`.' },
  Open: { title: "Open", hidden: true },
}
