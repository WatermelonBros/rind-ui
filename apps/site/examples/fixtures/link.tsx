"use client"

// Ported from apps/storybook/stories/Link.stories.tsx
import { Link, RouterProvider } from "@rind-ui/react"
import { useState } from "react"
import { fakeRouter, navigationLog } from "../../../../packages/testing/src/navigation"
import type { States, Variants } from "../types"

// Examples never navigate the page: every Link sits under a router whose `navigate` only
// records, and hrefs are in-page ("#...") or open another tab.
function Recording({ children }: { children: React.ReactNode }) {
  const [router] = useState(() => fakeRouter())
  const [calls, setCalls] = useState<string[]>([])
  return (
    <RouterProvider
      navigate={(href, options) => {
        router.navigate(href, options)
        setCalls((c) => [...c, String(href)])
      }}
    >
      {children}
      <p data-testid="calls">Router calls: {calls.length === 0 ? "none" : calls.join(", ")}</p>
    </RouterProvider>
  )
}

export const states: States = {
  link: {
    enabled: "Standalone",
    current: "CurrentStory",
    disabled: "DisabledStory",
    fallback: "AsDiv",
  },
}

export function Inline() {
  return (
    <Recording>
      <p style={{ maxWidth: "40ch" }}>
        Read the <Link href="#guide">getting started guide</Link> before you theme anything, then
        browse the <Link href="#reference">API reference</Link>.
      </p>
    </Recording>
  )
}

export function Standalone() {
  return (
    <Recording>
      <Link href="#docs">Documentation</Link>
    </Recording>
  )
}

export function ExternalStory() {
  return (
    <Recording>
      <Link href="https://example.org" target="_blank">
        Example (opens in a new tab)
      </Link>
    </Recording>
  )
}

export function CurrentStory() {
  return (
    <Recording>
      <Link href="#docs" current="page">
        Documentation
      </Link>
    </Recording>
  )
}

export function DisabledStory() {
  return (
    <Recording>
      <Link href="#docs" disabled>
        Documentation
      </Link>
    </Recording>
  )
}

export function FocusableWhenDisabled() {
  return (
    <Recording>
      <Link href="#docs" disabled focusableWhenDisabled>
        Documentation
      </Link>
    </Recording>
  )
}

/** No `href`-capable tag: a div gets role="link" and tabindex. */
export function AsDiv() {
  return (
    <Recording>
      <Link href="#docs" render={<div />}>
        Documentation
      </Link>
    </Recording>
  )
}

export function Danger() {
  return (
    <Recording>
      <div data-tone="danger" style={{ display: "grid", gap: "var(--rind-space-2)" }}>
        <Link href="#docs">Delete account</Link>
        <Link href="#docs" current="page">
          Current
        </Link>
        <Link href="#docs" disabled>
          Disabled
        </Link>
        <Link href="#docs" focusableWhenDisabled disabled>
          Focusable when disabled
        </Link>
      </div>
    </Recording>
  )
}

/**
 * A router-like Link component, as react-router's: it runs the props' onClick first, then
 * navigates itself unless that prevented it or a modifier is held. The RouterProvider's
 * router is never called for it.
 */
function RouterLink({
  to,
  onClick,
  children,
  ...rest
}: { to: string } & React.ComponentPropsWithoutRef<"a">) {
  return (
    <a
      {...rest}
      href={to}
      onClick={(e) => {
        onClick?.(e)
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return
        e.preventDefault()
        navigationLog().push({ href: to, newTab: false, via: "router" })
      }}
    >
      {children}
    </a>
  )
}

export function RenderRouterLink() {
  return (
    <Recording>
      <Link href="#docs" render={<RouterLink to="/docs" />}>
        Documentation
      </Link>
    </Recording>
  )
}

export function Rtl() {
  return (
    <Recording>
      <div dir="rtl" lang="ar">
        <Link href="#docs">الوثائق</Link>
      </div>
    </Recording>
  )
}

/** The driver: one router call per `follow`, whichever way it is done. */
export function FollowedWithDriver() {
  return (
    <Recording>
      <Link href="/docs">Documentation</Link>
    </Recording>
  )
}

export function Queries() {
  return (
    <Recording>
      <Link href="https://example.org" current="page" target="_blank">
        Documentation
      </Link>
    </Recording>
  )
}

export function DisabledQuery() {
  return (
    <Recording>
      <Link href="#docs" disabled>
        Documentation
      </Link>
    </Recording>
  )
}

export const variants: Variants = {
  Inline: { title: "Inline", hidden: true },
  Standalone: { title: "Standalone", hidden: true },
  ExternalStory: { title: "External", hidden: true },
  CurrentStory: { title: "Current", hidden: true },
  DisabledStory: { title: "Disabled", hidden: true },
  FocusableWhenDisabled: { title: "Focusable when disabled", hidden: true },
  AsDiv: { title: "As div", hidden: true },
  Danger: { title: "Danger", hidden: true },
  RenderRouterLink: { title: "Render router link", hidden: true },
  Rtl: { title: "Rtl", hidden: true },
  FollowedWithDriver: { title: "Followed with driver", hidden: true },
  Queries: { title: "Queries", hidden: true },
  DisabledQuery: { title: "Disabled query", hidden: true },
}
