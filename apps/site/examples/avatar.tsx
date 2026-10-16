"use client"

import { Avatar } from "@rind-ui/react"
import type { States, Variants } from "./types"

export const states: States = {
  avatar: { idle: "Initials", loading: "Lazy", loaded: "Basic", error: "Broken" },
}

// Images are inline SVG data URLs: the site builds and runs with no network.
const face = (bg: string, fg: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="${bg}"/><circle cx="40" cy="32" r="14" fill="${fg}"/><path d="M14 80c2-16 13-24 26-24s24 8 26 24z" fill="${fg}"/></svg>`,
  )}`
const ADA = face("#c4b5fd", "#4c1d95")
const ALAN = face("#99f6e4", "#134e4a")
const GRACE = face("#fde68a", "#78350f")
// A malformed data URL fails without a network request.
const BROKEN = "data:image/png;base64,broken"

export function Basic() {
  return (
    <div className="row">
      <Avatar.Root aria-label="Ada Lovelace">
        <Avatar.Image src={ADA} />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root aria-label="Alan Turing" data-size="lg">
        <Avatar.Image src={ALAN} />
        <Avatar.Fallback>AT</Avatar.Fallback>
      </Avatar.Root>
    </div>
  )
}

export function Initials() {
  return (
    <div className="row">
      <Avatar.Root aria-label="Grace Hopper">
        <Avatar.Image />
        <Avatar.Fallback>GH</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root aria-label="Katherine Johnson" data-variant="solid">
        <Avatar.Fallback>KJ</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root aria-label="Edsger Dijkstra" data-variant="outline">
        <Avatar.Fallback>ED</Avatar.Fallback>
      </Avatar.Root>
    </div>
  )
}

export function Broken() {
  return (
    <Avatar.Root aria-label="Margaret Hamilton">
      <Avatar.Image src={BROKEN} />
      <Avatar.Fallback>MH</Avatar.Fallback>
    </Avatar.Root>
  )
}

export function Lazy() {
  return (
    <div className="stack">
      <span className="note">Scroll down: the image loads when it nears the viewport.</span>
      <section
        aria-label="Lazy avatar"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
        tabIndex={0}
        style={{ blockSize: 120, overflow: "auto", border: "1px dashed currentColor" }}
      >
        <div style={{ blockSize: 1200 }} />
        <Avatar.Root aria-label="Ada Lovelace">
          <Avatar.Image src={ADA} loading="lazy" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </section>
    </div>
  )
}

export function Decorative() {
  return (
    <p className="row">
      <Avatar.Root aria-hidden="true" data-size="sm">
        <Avatar.Image src={GRACE} />
        <Avatar.Fallback>GH</Avatar.Fallback>
      </Avatar.Root>
      <span>Grace Hopper commented on the pull request.</span>
    </p>
  )
}

export function InButton() {
  return (
    <button type="button" className="row">
      <Avatar.Root aria-label="Ada Lovelace" data-size="sm">
        <Avatar.Image src={ADA} />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    </button>
  )
}

export function Group() {
  const people = [
    ["Ada Lovelace", ADA],
    ["Alan Turing", ALAN],
    ["Grace Hopper", GRACE],
  ] as const
  return (
    <Avatar.Group aria-label="Reviewers">
      {people.map(([name, src]) => (
        <Avatar.Root key={name} aria-label={name}>
          <Avatar.Image src={src} />
          <Avatar.Fallback>{name.slice(0, 1)}</Avatar.Fallback>
        </Avatar.Root>
      ))}
      <Avatar.GroupOverflow count={4} />
    </Avatar.Group>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: 'Root carries the name (`role="img"`); the image is `alt=""`.',
  },
  Initials: {
    title: "Fallback",
    description: "No image: the Fallback shows at once. Soft, solid and outline variants.",
  },
  Broken: {
    title: "Broken image",
    description: 'An error hides the `<img>` and brings the Fallback back; `data-state="error"`.',
  },
  Lazy: {
    title: "Lazy loading",
    description: 'The rendered `<img>` is the loader, so `loading="lazy"` works.',
  },
  Decorative: {
    title: "Decorative",
    description: '`aria-hidden="true"` beside the visible name: read once, from the text.',
  },
  InButton: {
    title: "Inside a button",
    description: "The button takes its name from the avatar's.",
  },
  Group: {
    title: "Group",
    description: 'A named group; "+4" is seen, "4 more" is heard.',
  },
}
