"use client"

import { Popover, SegmentedControl, Slider } from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import type { Variants } from "./types"

type Side = "top" | "right" | "bottom" | "left"
type Align = "start" | "center" | "end"

/** A popover that stays open while the controls around it change its options. */
function Pinned({
  label,
  positioning,
  children,
}: {
  label: string
  positioning: Parameters<typeof Popover.Root>[0]["positioning"]
  children: React.ReactNode
}) {
  return (
    <Popover.Root
      open
      onOpenChange={() => {}}
      closeOnInteractOutside={false}
      closeOnEscape={false}
      finalFocus={false}
      initialFocus={() => null}
      {...(positioning ? { positioning } : {})}
    >
      <Popover.Trigger>{label}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Content aria-label={label}>
            {children}
            <Popover.Arrow />
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function Basic() {
  const [side, setSide] = useState<Side>("bottom")
  const [align, setAlign] = useState<Align>("center")
  const [offset, setOffset] = useState(8)
  return (
    <div className="stack">
      <SegmentedControl.Root
        aria-label="side"
        value={side}
        onValueChange={(v) => v && setSide(v as Side)}
      >
        {(["top", "right", "bottom", "left"] as const).map((s) => (
          <SegmentedControl.Item key={s} value={s}>
            {s}
          </SegmentedControl.Item>
        ))}
        <SegmentedControl.Indicator />
      </SegmentedControl.Root>
      <SegmentedControl.Root
        aria-label="align"
        value={align}
        onValueChange={(v) => v && setAlign(v as Align)}
      >
        {(["start", "center", "end"] as const).map((a) => (
          <SegmentedControl.Item key={a} value={a}>
            {a}
          </SegmentedControl.Item>
        ))}
        <SegmentedControl.Indicator />
      </SegmentedControl.Root>
      <Slider.Root
        value={offset}
        min={0}
        max={40}
        onValueChange={(v) => setOffset(typeof v === "number" ? v : (v[0] ?? 0))}
      >
        <Slider.Label>sideOffset</Slider.Label>
        <Slider.ValueText />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb index={0} />
        </Slider.Control>
      </Slider.Root>
      <div className="anchor-stage">
        <Pinned label="Anchor" positioning={{ side, align, sideOffset: offset }}>
          <p>
            <code>{side}</code> · <code>{align}</code> · {offset}px
          </p>
        </Pinned>
      </div>
    </div>
  )
}

export function Flip() {
  const box = useRef<HTMLElement>(null)
  // start with the anchor in the middle of the box
  useEffect(() => {
    if (box.current)
      box.current.scrollTop = (box.current.scrollHeight - box.current.clientHeight) / 2
  }, [])
  return (
    <section
      ref={box}
      className="flip-box"
      aria-label="Scroll to flip the popup"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard
      tabIndex={0}
    >
      <div className="flip-inner">
        <Pinned
          label="Scroll me"
          positioning={{ side: "top", collisionBoundary: () => box.current ?? document.body }}
        >
          <p>
            Asked for <code>top</code>; flips to <code>bottom</code> when the box has no room.
          </p>
        </Pinned>
      </div>
    </section>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Side, align and offset",
    description: "One popover, its `positioning` driven by the controls above it.",
  },
  Flip: {
    title: "Flip",
    description: "Scroll the box: with no room on its side, the popup flips to the other.",
  },
}
