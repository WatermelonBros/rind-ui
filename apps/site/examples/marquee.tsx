"use client"

import { Marquee, type MarqueeRootProps, RindProvider } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/** `idle` lasts until the first measurement (the server render); `running` is the default. */
export const states: States = {
  marquee: { running: "Logos", paused: "Paused", static: "ReducedMotion" },
}

const LOGOS = ["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Stark", "Wayne", "Tyrell"]

/** Phosphor (regular) icons; any node works in their place. */
function PhosphorIcon({ d }: { readonly d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" width="16" height="16" fill="currentColor">
      <path d={d} />
    </svg>
  )
}
const PAUSE =
  "M200,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,176H160V48h40ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Zm0,176H56V48H96Z"
const PLAY =
  "M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"

/** The PauseTrigger's icon follows its name: pause while moving, play while paused. */
function Toggle() {
  return (
    <Marquee.PauseTrigger
      render={(props, { paused }) => (
        <button {...props}>
          <PhosphorIcon d={paused ? PLAY : PAUSE} />
        </button>
      )}
    />
  )
}

function Band({
  label,
  items = LOGOS,
  links = false,
  ...props
}: MarqueeRootProps & {
  readonly label: string
  readonly items?: readonly string[]
  readonly links?: boolean
}) {
  return (
    <Marquee.Root role="region" aria-label={label} {...props}>
      <Toggle />
      <Marquee.Viewport>
        <Marquee.Content>
          {items.map((name) =>
            links ? (
              <a
                key={name}
                href={`#${name.toLowerCase()}`}
                className="logo"
                // The unstyled host's default link blue fails contrast in the dark scheme.
                style={{ color: "inherit" }}
              >
                {name}
              </a>
            ) : (
              <span key={name} className="logo">
                {name}
              </span>
            ),
          )}
        </Marquee.Content>
      </Marquee.Viewport>
    </Marquee.Root>
  )
}

export function Logos() {
  return <Band label="Customers" links />
}

export function Ticker() {
  return (
    <Band
      label="Release notes"
      speed={80}
      items={[
        "v0.4 ships Table",
        "Clipboard is done",
        "File Upload lands next",
        "Marquee in review",
      ]}
    />
  )
}

export function Vertical() {
  return <Band label="Customers, vertical" orientation="vertical" speed={30} />
}

export function Reverse() {
  return <Band label="Customers, reversed" reverse />
}

export function RightToLeft() {
  return (
    <div dir="rtl">
      <Band
        label="Customers, right to left"
        items={["أكمي", "جلوبكس", "إنيتك", "أمبريلا", "هولي"]}
      />
    </div>
  )
}

export function AutoFill() {
  return <Band label="Short list" items={["Acme", "Globex"]} autoFill />
}

export function Controlled() {
  const [paused, setPaused] = useState(false)
  return (
    <div className="stack">
      <Band label="Customers, controlled" paused={paused} onPausedChange={setPaused} />
      <output>{paused ? "Paused" : "Moving"}</output>
    </div>
  )
}

export function NoHoverPause() {
  return <Band label="Customers, no hover pause" pauseOnHover={false} />
}

export function Paused() {
  return <Band label="Customers, paused" defaultPaused />
}

export function ReducedMotion() {
  return (
    <RindProvider environment={{ reducedMotion: true }}>
      <Band label="Customers, reduced motion" />
    </RindProvider>
  )
}

export const variants: Variants = {
  Logos: {
    motion: "keep",
    title: "Logos with links",
    description:
      "Hover or Tab into the band pauses it; the button pauses for good. Copies are hidden and untabbable, still clickable.",
  },
  Ticker: { motion: "keep", title: "Text ticker", description: "`speed` in CSS px per second." },
  Vertical: {
    motion: "keep",
    title: "Vertical",
    description: '`orientation="vertical"`: the column moves up.',
  },
  Reverse: {
    motion: "keep",
    title: "Reverse",
    description: "`reverse` moves toward the inline end.",
  },
  RightToLeft: {
    motion: "keep",
    title: "Right to left",
    description: "In RTL the band moves right.",
  },
  AutoFill: {
    motion: "keep",
    title: "Auto fill",
    description: "`autoFill`: enough copies to fill the Viewport, so a short list has no gap.",
  },
  Controlled: {
    motion: "keep",
    title: "Controlled",
    description: "`paused` and `onPausedChange`.",
  },
  NoHoverPause: {
    motion: "keep",
    title: "No hover pause",
    description: "`pauseOnHover={false}`: only the button and keyboard focus pause it.",
  },
  Paused: { motion: "keep", title: "Paused", description: "`defaultPaused`: it starts held." },
  ReducedMotion: {
    title: "Reduced motion",
    description: "One copy, wrapped, no motion and no button.",
  },
}
