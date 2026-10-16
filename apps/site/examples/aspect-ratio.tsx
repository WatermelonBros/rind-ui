"use client"

// Aspect Ratio is a recipe, not a component (add-aspect-ratio): every example is the native
// CSS `aspect-ratio` property on the element itself, with no wrapper.
import type { Variants } from "./types"

// Inline images: the site builds and runs without network.
const landscape = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect width="400" height="200" fill="#7dd3fc"/><circle cx="320" cy="60" r="32" fill="#fde047"/><path d="M0 200 140 70 250 170 310 120 400 200Z" fill="#166534"/></svg>',
)}`
const portrait = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><rect width="200" height="300" fill="#fbcfe8"/><circle cx="100" cy="110" r="56" fill="#be185d"/><rect x="40" y="190" width="120" height="80" rx="40" fill="#be185d"/></svg>',
)}`

const box = { background: "color-mix(in oklab, currentColor 10%, transparent)", borderRadius: 8 }

export function Basic() {
  return (
    <div data-example="ratio-box" style={{ ...box, aspectRatio: "16 / 9", inlineSize: "100%" }} />
  )
}

export function Thumbnails() {
  return (
    <ul
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
        gap: 8,
        padding: 0,
        margin: 0,
        listStyle: "none",
      }}
    >
      {["Lake", "Hills", "Portrait", "Coast"].map((name, i) => (
        <li key={name}>
          {/* biome-ignore lint/performance/noImgElement: the recipe is the plain element; next/image adds nothing here */}
          <img
            src={i % 2 ? portrait : landscape}
            alt={name}
            style={{ aspectRatio: "1", inlineSize: "100%", objectFit: "cover", borderRadius: 8 }}
          />
        </li>
      ))}
    </ul>
  )
}

export function ObjectFit() {
  const media = { aspectRatio: "4 / 3", inlineSize: "100%", ...box }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <figure style={{ margin: 0 }}>
        {/* biome-ignore lint/performance/noImgElement: the recipe is the plain element; next/image adds nothing here */}
        <img src={portrait} alt="A portrait, cropped" style={{ ...media, objectFit: "cover" }} />
        <figcaption>cover</figcaption>
      </figure>
      <figure style={{ margin: 0 }}>
        {/* biome-ignore lint/performance/noImgElement: the recipe is the plain element; next/image adds nothing here */}
        <img
          src={portrait}
          alt="A portrait, letterboxed"
          style={{ ...media, objectFit: "contain" }}
        />
        <figcaption>contain</figcaption>
      </figure>
    </div>
  )
}

export function Embeds() {
  return (
    <div className="stack">
      <iframe
        title="Map of the office"
        srcDoc="<p style='font:16px system-ui;margin:16px'>An embedded page keeps its own name.</p>"
        style={{ aspectRatio: "16 / 9", inlineSize: "100%", border: 0, ...box }}
      />
      <video
        aria-label="Product tour"
        controls
        style={{ aspectRatio: "16 / 9", inlineSize: "100%", ...box }}
      >
        <track kind="captions" srcLang="en" label="English" src="data:text/vtt,WEBVTT" />
      </video>
    </div>
  )
}

export function IntrinsicSize() {
  // width/height attributes give the image its ratio before it loads: no layout shift.
  return (
    // biome-ignore lint/performance/noImgElement: the recipe is the plain element; next/image adds nothing here
    <img
      src={landscape}
      alt="Lake and hills"
      width={400}
      height={200}
      style={{ inlineSize: "100%", blockSize: "auto" }}
    />
  )
}

export function InAFlexRow() {
  return (
    <div data-example="flex-row" style={{ display: "flex", gap: 12 }}>
      <div data-example="ratio-box" style={{ ...box, aspectRatio: "16 / 9", inlineSize: "50%" }} />
      <p style={{ margin: 0 }}>The box sits in a flex row and keeps its ratio.</p>
    </div>
  )
}

export function GrowsWithText() {
  return (
    <article
      data-example="text-card"
      style={{ ...box, aspectRatio: "1", inlineSize: "12rem", padding: "1rem" }}
    >
      <h3 style={{ marginBlockStart: 0 }}>Square card</h3>
      <p>
        When the text needs more room, at 200 % zoom or in a longer language, the card grows taller
        instead of clipping it.
      </p>
    </article>
  )
}

export const variants: Variants = {
  Basic: { title: "Ratio box", description: "`aspect-ratio: 16 / 9` on the element itself." },
  Thumbnails: { title: "Square thumbnails", description: "`aspect-ratio: 1` on each image." },
  ObjectFit: {
    title: "Media fit",
    description: "`object-fit` is the media's own CSS: `cover` crops, `contain` letterboxes.",
  },
  Embeds: { title: "Embeds", description: "An iframe and a video keep their own names." },
  IntrinsicSize: {
    title: "Image before it loads",
    description: "`width` and `height` attributes reserve the ratio: no layout shift.",
  },
  InAFlexRow: { title: "In a flex row", description: "No wrapper, so flex and grid just work." },
  GrowsWithText: {
    title: "Text grows the box",
    description: "A preferred ratio: content taller than the box makes it taller.",
  },
}
