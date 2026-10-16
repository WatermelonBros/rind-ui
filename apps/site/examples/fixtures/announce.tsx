"use client"

// Ported from apps/storybook/stories/AnnounceFixture.stories.tsx
// The add-a11y-foundations streaming fixture: announces "Hello there" once.
import { StreamFixture } from "../../../../packages/testing/fixtures/announce/announce.react"
import type { States, Variants } from "../types"

export const states: States = { stream: { idle: "Stream" } }

export function Stream() {
  return <StreamFixture />
}

export const variants: Variants = {
  Stream: { title: "Stream", hidden: true },
}
