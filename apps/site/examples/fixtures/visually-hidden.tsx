"use client"

// Ported from apps/storybook/stories/VisuallyHidden.stories.tsx
import { VisuallyHidden } from "@rind-ui/react"
import type { Variants } from "../types"

/** An icon button named by a visually hidden label. */
export function IconButtonLabel() {
  return (
    <button type="button">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" />
      </svg>
      <VisuallyHidden>Close</VisuallyHidden>
    </button>
  )
}

/** A skip link: visible only while it has keyboard focus. */
export function SkipLink() {
  return (
    <>
      <VisuallyHidden focusable render={<a href="#main" />}>
        Skip to content
      </VisuallyHidden>
      <main id="main">Content</main>
    </>
  )
}

export const variants: Variants = {
  IconButtonLabel: { title: "Icon button label", hidden: true },
  SkipLink: { title: "Skip link", hidden: true },
}
