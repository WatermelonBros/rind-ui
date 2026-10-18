"use client"

import { Image, Skeleton } from "@rind-ui/react"
import type { States, Variants } from "./types"

export const states: States = {
  image: { idle: "NoSource", loading: "Lazy", loaded: "Basic", error: "Broken" },
}

// Images are inline SVG data URLs: the site builds and runs with no network.
const BIKE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#fde68a"/><g fill="none" stroke="#b91c1c" stroke-width="8"><circle cx="90" cy="120" r="40"/><circle cx="230" cy="120" r="40"/><path d="M90 120 140 60h70l20 60M140 60l30 60h60"/></g></svg>',
)}`
// A malformed data URL fails without a network request.
const BROKEN = "data:image/png;base64,broken"
const ratio = {
  inlineSize: "100%",
  maxInlineSize: 320,
  ["--rind-image-aspect-ratio" as string]: "16 / 9",
}

export function Basic() {
  return (
    <Image.Root alt="A red bicycle" style={ratio}>
      <Image.Img src={BIKE} />
      <Image.Fallback>Image unavailable</Image.Fallback>
    </Image.Root>
  )
}

export function Broken() {
  return (
    <Image.Root alt="A red bicycle" style={ratio}>
      <Image.Img src={BROKEN} />
      <Image.Fallback>
        <span aria-hidden="true">⚠</span>
      </Image.Fallback>
    </Image.Root>
  )
}

export function NoSource() {
  return (
    <Image.Root alt="A red bicycle" style={ratio}>
      <Image.Img />
      <Image.Fallback>No image yet</Image.Fallback>
    </Image.Root>
  )
}

export function Lazy() {
  return (
    <div className="stack">
      <span className="note">Scroll down: the image loads when it nears the viewport.</span>
      <section
        aria-label="Lazy image"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
        tabIndex={0}
        style={{ blockSize: 200, overflow: "auto", border: "1px dashed currentColor" }}
      >
        <div style={{ blockSize: 1200 }} />
        <Image.Root alt="A red bicycle" style={ratio}>
          <Image.Img src={BIKE} loading="lazy" />
          <Image.Fallback>Loading…</Image.Fallback>
        </Image.Root>
      </section>
    </div>
  )
}

export function SkeletonFallback() {
  // The Fallback holds a placeholder; the Image keeps the name, so the Item stays silent.
  return (
    <Image.Root alt="A red bicycle" style={ratio}>
      <Image.Img src={BROKEN} />
      <Image.Fallback>
        <Skeleton.Root loading>
          <Skeleton.Item data-shape="block" />
        </Skeleton.Root>
      </Image.Fallback>
    </Image.Root>
  )
}

export function Contain() {
  return (
    <Image.Root
      alt="A red bicycle, letterboxed"
      style={{
        ...ratio,
        ["--rind-image-aspect-ratio" as string]: "1",
        ["--rind-image-fit" as string]: "contain",
      }}
    >
      <Image.Img src={BIKE} />
    </Image.Root>
  )
}

export function Figure() {
  return (
    <figure style={{ margin: 0, maxInlineSize: 320 }}>
      <Image.Root alt="A red bicycle leaning on a yellow wall" style={ratio}>
        <Image.Img src={BIKE} />
      </Image.Root>
      <figcaption>The courier's bike, 1998.</figcaption>
    </figure>
  )
}

export function InLink() {
  return (
    <a href="/docs/image/" style={{ display: "inline-block", maxInlineSize: 320 }}>
      <Image.Root alt="Bicycles" style={ratio}>
        <Image.Img src={BIKE} />
      </Image.Root>
    </a>
  )
}

export function Decorative() {
  return (
    <div className="row">
      <Image.Root alt="" style={{ inlineSize: 64, ["--rind-image-aspect-ratio" as string]: "1" }}>
        <Image.Img src={BIKE} />
      </Image.Root>
      <span>Bicycles</span>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic", description: "Loaded: the `<img>` is named by Root's `alt`." },
  Broken: {
    title: "Broken image",
    description: 'An error hides the `<img>`; Root takes the name (`role="img"`), the box stays.',
  },
  NoSource: {
    title: "No source",
    description: "`idle`: no `<img>` drawn, Root carries the name, the Fallback shows at once.",
  },
  Lazy: {
    title: "Lazy loading",
    description: 'The rendered `<img>` is the loader: `loading="lazy"` keeps its fallback.',
  },
  SkeletonFallback: {
    title: "Skeleton fallback",
    description: "A Skeleton.Item in the Fallback: hidden like every Fallback.",
  },
  Contain: {
    title: "Ratio and fit",
    description: "`--rind-image-aspect-ratio` and `--rind-image-fit: contain`.",
  },
  Figure: {
    title: "In a figure",
    description: "`alt` describes the image; the caption adds to it.",
  },
  InLink: { title: "In a link", description: "The link takes its name from `alt`." },
  Decorative: {
    title: "Decorative",
    description: '`alt=""`: nothing of the image is exposed, in any status.',
  },
}
