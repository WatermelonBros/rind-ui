"use client"

import { Breadcrumbs, Link, Popover } from "@rind-ui/react"
import { Fragment } from "react"
import type { Variants } from "./types"

interface Crumb {
  readonly label: string
  readonly href?: string
}

const DOCS: readonly Crumb[] = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs/" },
  { label: "Breadcrumbs" },
]

const LONG: readonly Crumb[] = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs/" },
  { label: "Components", href: "/docs/" },
  { label: "Navigation", href: "/docs/" },
  { label: "Breadcrumbs", href: "/docs/breadcrumbs/" },
  { label: "Collapsing" },
]

/** The collapsed items in a Popover: its trigger is named by the Ellipsis' `label`. */
function MoreCrumbs() {
  return (
    <Breadcrumbs.Ellipsis>
      {({ items, label }) => (
        <Popover.Root>
          <Popover.Trigger aria-label={label}>…</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Content aria-label="More breadcrumbs">
                <ul className="stack crumb-menu">
                  {items.map((it) => (
                    <li key={it.key}>
                      <Link {...(it.href ? { href: String(it.href) } : {})}>{it.textValue}</Link>
                    </li>
                  ))}
                </ul>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
    </Breadcrumbs.Ellipsis>
  )
}

function Trail({
  crumbs,
  maxItems,
  separator = "/",
  label,
}: {
  crumbs: readonly Crumb[]
  maxItems?: number
  separator?: string | null
  label?: string
}) {
  return (
    <Breadcrumbs.Root
      {...(maxItems === undefined ? {} : { maxItems })}
      {...(label ? { "aria-label": label } : {})}
    >
      <Breadcrumbs.List>
        {crumbs.map((c, i) => (
          <Fragment key={c.label}>
            <Breadcrumbs.Item value={c.label}>
              <Breadcrumbs.Link {...(c.href ? { href: c.href } : {})}>{c.label}</Breadcrumbs.Link>
              {separator !== null && <Breadcrumbs.Separator>{separator}</Breadcrumbs.Separator>}
            </Breadcrumbs.Item>
            {i === 0 && maxItems !== undefined && <MoreCrumbs />}
          </Fragment>
        ))}
      </Breadcrumbs.List>
    </Breadcrumbs.Root>
  )
}

export function Basic() {
  return <Trail crumbs={DOCS} />
}

export function CurrentLink() {
  return (
    <Breadcrumbs.Root aria-label="Breadcrumbs with a linked current page">
      <Breadcrumbs.List>
        {DOCS.map((c) => (
          <Breadcrumbs.Item key={c.label} value={c.label}>
            <Breadcrumbs.Link href={c.href ?? "/docs/breadcrumbs/"}>{c.label}</Breadcrumbs.Link>
            <Breadcrumbs.Separator>›</Breadcrumbs.Separator>
          </Breadcrumbs.Item>
        ))}
      </Breadcrumbs.List>
    </Breadcrumbs.Root>
  )
}

export function Collapsed() {
  return <Trail crumbs={LONG} maxItems={4} label="Collapsed breadcrumbs" />
}

export function Chevrons() {
  return <Trail crumbs={DOCS} separator="›" label="Breadcrumbs with chevrons" />
}

export function PathSegments() {
  // A file path: each segment is a button (a menu trigger in a real app), the file is current.
  const segments = ["src", "components", "Button.tsx"]
  return (
    <Breadcrumbs.Root aria-label="File path" currentValue="location">
      <Breadcrumbs.List>
        {segments.map((name) => (
          <Breadcrumbs.Item key={name} value={name}>
            {(state) => (
              <>
                <button
                  type="button"
                  className="crumb-button"
                  aria-current={state.current ? "location" : undefined}
                >
                  {name}
                </button>
                <Breadcrumbs.Separator>/</Breadcrumbs.Separator>
              </>
            )}
          </Breadcrumbs.Item>
        ))}
      </Breadcrumbs.List>
    </Breadcrumbs.Root>
  )
}

export function RightToLeft() {
  return (
    <div dir="rtl" lang="ar">
      <Trail
        crumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "المستندات", href: "/docs/" },
          { label: "مسار التنقل" },
        ]}
        separator="›"
        label="مسار التنقل"
      />
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description:
      'A `navigation` landmark; the last item is current, a text with `aria-current="page"`.',
  },
  CurrentLink: {
    title: "Current page as a link",
    description: "With an `href` the current item stays a link, with `aria-current`.",
  },
  Collapsed: {
    title: "Collapsed",
    description:
      '`maxItems={4}` hides the middle items; the Ellipsis gives them to a Popover whose trigger is named "Show 4 more breadcrumbs".',
  },
  Chevrons: {
    title: "Custom separator",
    description: "Separators are `aria-hidden` glyphs you choose.",
  },
  PathSegments: {
    title: "Path segments",
    description:
      "Items with their own controls: the Item's state tells the last button to carry `aria-current`.",
  },
  RightToLeft: { title: "Right to left", description: "Chevrons mirror in right-to-left text." },
}
