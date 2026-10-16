"use client"

// Ported from apps/storybook/stories/PressFixture.stories.tsx
// The add-a11y-foundations press fixture: not public components (Button and Toggle get their
// own changes).
import {
  CounterButton,
  ToggleButton,
} from "../../../../packages/testing/fixtures/press/press.react"
import type { States, Variants } from "../types"

export const states: States = {
  toggle: { off: "ToggleOff", on: "ToggleOn" },
  counter: { idle: "Counter" },
}

export function ToggleOff() {
  return <ToggleButton>Bold</ToggleButton>
}

export function ToggleOn() {
  return <ToggleButton defaultPressed>Bold</ToggleButton>
}

export function ToggleDisabled() {
  return <ToggleButton disabled>Bold</ToggleButton>
}

export function Counter() {
  return <CounterButton>Add</CounterButton>
}

export const variants: Variants = {
  ToggleOff: { title: "Toggle off", hidden: true },
  ToggleOn: { title: "Toggle on", hidden: true },
  ToggleDisabled: { title: "Toggle disabled", hidden: true },
  Counter: { title: "Counter", hidden: true },
}
