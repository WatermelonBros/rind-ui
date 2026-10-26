"use client"

import { Carousel } from "@rind-ui/react"
import type { States, Variants } from "./types"

export const states: States = { carousel: { stopped: "Basic", playing: "Autoplay" } }

const slides = [
  { id: "lisbon", title: "Lisbon", note: "Trams and tiles", hue: 18 },
  { id: "kyoto", title: "Kyoto", note: "Temples in the rain", hue: 340 },
  { id: "oslo", title: "Oslo", note: "Fjords at noon", hue: 205 },
  { id: "lima", title: "Lima", note: "Cliffs over the Pacific", hue: 45 },
  { id: "hanoi", title: "Hanoi", note: "Lanterns and noodles", hue: 150 },
]

function Deck({ perPage, autoplay }: { readonly perPage: number; readonly autoplay?: boolean }) {
  return (
    <Carousel.Root
      aria-label="Destinations"
      slidesPerPage={perPage}
      spacing="12px"
      autoplay={autoplay === true}
      loop={autoplay === true}
    >
      <Carousel.Viewport>
        {slides.map((s, i) => (
          <Carousel.Slide key={s.id} index={i}>
            <article className="trip" style={{ "--trip-hue": s.hue } as React.CSSProperties}>
              <h3>{s.title}</h3>
              <p>{s.note}</p>
              <a href={`#${s.id}`}>Plan a trip</a>
            </article>
          </Carousel.Slide>
        ))}
      </Carousel.Viewport>
      <div className="row carousel-bar">
        <Carousel.Control>
          <Carousel.PrevTrigger>‹</Carousel.PrevTrigger>
          <Carousel.NextTrigger>›</Carousel.NextTrigger>
          {autoplay && <Carousel.AutoplayTrigger>⏯</Carousel.AutoplayTrigger>}
        </Carousel.Control>
        <Carousel.IndicatorGroup>
          {({ pages }) =>
            Array.from({ length: pages }, (_, p) => p).map((p) => (
              <Carousel.Indicator key={p} index={p} />
            ))
          }
        </Carousel.IndicatorGroup>
        <Carousel.Status />
      </div>
    </Carousel.Root>
  )
}

export function Basic() {
  return <Deck perPage={1} />
}

export function TwoPerPage() {
  return <Deck perPage={2} />
}

export function Autoplay() {
  return <Deck perPage={1} autoplay />
}

export const variants: Variants = {
  Basic: {
    title: "One per page",
    description:
      "Swipe or scroll the slides, or use the arrows and dots (one Tab stop, arrow keys). Hidden slides are inert.",
  },
  TwoPerPage: {
    title: "Two per page",
    description: "slidesPerPage 2: five slides make three pages.",
  },
  Autoplay: {
    title: "Autoplay",
    description:
      "Off by default; here on, with a stop control. Hover pauses, focus stops it, a hidden tab pauses it.",
    motion: "keep",
  },
}
