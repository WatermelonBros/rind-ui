"use client"

// Ported from apps/storybook/stories/Button.stories.tsx
import { Button, RouterProvider } from "@rind-ui/react"
import { useState } from "react"
import { fakeRouter } from "../../../../packages/testing/src/navigation"
import type { States, Variants } from "../types"

/** State examples: contract scope → state → example export (ARIA snapshot per state). */
export const states: States = {
  button: { idle: "Default", pending: "PendingState" },
}

const row = {
  display: "flex",
  gap: "var(--rind-space-2)",
  alignItems: "center",
  flexWrap: "wrap",
} as const

export function Default() {
  return <Button>Save</Button>
}

const kinds = ["solid", "soft", "outline", "ghost"] as const
const sizes = ["sm", "md", "lg"] as const

// Named VariantsStory: `Variants` is the imported type.
export function VariantsStory() {
  return (
    <div style={{ display: "grid", gap: "var(--rind-space-3)" }}>
      {kinds.map((variant) => (
        <div key={variant} style={row}>
          {sizes.map((size) => (
            <Button key={size} data-variant={variant} data-size={size}>
              {variant} {size}
            </Button>
          ))}
        </div>
      ))}
    </div>
  )
}

export function IconOnly() {
  return (
    <Button aria-label="Close">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" />
      </svg>
    </Button>
  )
}

export function DisabledStory() {
  return <Button disabled>Save</Button>
}

export function FocusableWhenDisabled() {
  return (
    <Button disabled focusableWhenDisabled>
      Save
    </Button>
  )
}

/** A Save that goes pending for two seconds; the label changes so sighted users see it too. */
export function PendingStory() {
  const [pending, setPending] = useState(false)
  return (
    <Button
      pending={pending}
      onPress={() => {
        setPending(true)
        setTimeout(() => setPending(false), 2000)
      }}
    >
      {pending ? "Saving…" : "Save"}
    </Button>
  )
}

export function PendingState() {
  return <Button pending>Saving…</Button>
}

export function AsLinkStory() {
  const [router] = useState(() => fakeRouter())
  const [calls, setCalls] = useState(0)
  return (
    <RouterProvider
      navigate={(href, options) => {
        router.navigate(href, options)
        setCalls((c) => c + 1)
      }}
    >
      <Button render={<a href="#docs" />}>Documentation</Button>
      <p>Router calls: {calls}</p>
    </RouterProvider>
  )
}

export function AsDiv() {
  return <Button render={<div />}>Save</Button>
}

export function InsideForm() {
  const [submits, setSubmits] = useState(0)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSubmits((n) => n + 1)
      }}
    >
      <div style={row}>
        <input aria-label="Name" defaultValue="Ada" />
        <Button type="submit">Submit</Button>
        <Button type="reset" data-variant="outline">
          Reset
        </Button>
      </div>
      <p data-testid="submits">Submits: {submits}</p>
    </form>
  )
}

export function Danger() {
  return (
    <div data-tone="danger" style={row}>
      {kinds.map((variant) => (
        <Button key={variant} data-variant={variant}>
          Delete {variant}
        </Button>
      ))}
      <Button disabled>Disabled</Button>
    </div>
  )
}

/** The driver: one press, observed through the counter. */
export function DriverExample() {
  const [count, setCount] = useState(0)
  return (
    <>
      <Button onPress={() => setCount((n) => n + 1)}>Save</Button>
      <p data-testid="count">Pressed: {count}</p>
    </>
  )
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  VariantsStory: { title: "Variants", hidden: true },
  IconOnly: { title: "Icon only", hidden: true },
  DisabledStory: { title: "Disabled", hidden: true },
  FocusableWhenDisabled: { title: "Focusable when disabled", hidden: true },
  PendingStory: { title: "Pending", hidden: true },
  PendingState: { title: "Pending state", hidden: true },
  AsLinkStory: { title: "As link", hidden: true },
  AsDiv: { title: "As div", hidden: true },
  InsideForm: { title: "Inside form", hidden: true },
  Danger: { title: "Danger", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
