"use client"

import { Alert, Heading } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { alert: { open: "Basic", closed: "Closed" } }

const Cross = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

export function Basic() {
  // Present when the page loads, and static: `announce="off"`.
  return (
    <Alert.Root announce="off">
      <Alert.Icon>ℹ</Alert.Icon>
      <Alert.Title>Maintenance tonight</Alert.Title>
      <Alert.Description>Saving is paused from 22:00 to 22:30.</Alert.Description>
    </Alert.Root>
  )
}

export function ErrorAfterAction() {
  const [error, setError] = useState(false)
  return (
    <div className="stack">
      <div className="row">
        <button type="button" onClick={() => setError(true)}>
          Save
        </button>
      </div>
      {error && (
        <Alert.Root announce="assertive" data-tone="danger" onOpenChange={() => setError(false)}>
          <Alert.Icon label="Error">!</Alert.Icon>
          <Alert.Title>Couldn't save</Alert.Title>
          <Alert.Description>The disk is full.</Alert.Description>
          <Alert.CloseTrigger>
            <Cross />
          </Alert.CloseTrigger>
        </Alert.Root>
      )}
      <div className="row">
        <button type="button">Retry</button>
      </div>
    </div>
  )
}

export function StatusUpdates() {
  const [connected, setConnected] = useState(false)
  return (
    <div className="stack">
      <Alert.Root data-tone={connected ? "success" : "warning"}>
        <Alert.Title>{connected ? "Connected" : "Reconnecting…"}</Alert.Title>
      </Alert.Root>
      <div className="row">
        <button type="button" onClick={() => setConnected((c) => !c)}>
          {connected ? "Drop the connection" : "Connect"}
        </button>
      </div>
    </div>
  )
}

export function Dismissible() {
  const [open, setOpen] = useState(true)
  return (
    <div className="stack">
      <Alert.Root open={open} onOpenChange={setOpen} data-variant="outline">
        <Alert.Title>Your trial ends in 3 days</Alert.Title>
        <Alert.CloseTrigger>Dismiss</Alert.CloseTrigger>
      </Alert.Root>
      <div className="row">
        <button type="button" onClick={() => setOpen(true)} disabled={open}>
          Show again
        </button>
      </div>
    </div>
  )
}

export function Tones() {
  return (
    <div className="stack">
      {["neutral", "success", "warning", "danger"].map((tone) => (
        <Alert.Root key={tone} announce="off" data-tone={tone} data-variant="soft">
          <Alert.Title>
            {tone[0]?.toUpperCase() + tone.slice(1)}: severity in words, not only colour
          </Alert.Title>
        </Alert.Root>
      ))}
    </div>
  )
}

export function Region() {
  return (
    <Alert.Root id="release" announce="off" role="region" aria-labelledby="alert-release-title">
      <Alert.Title>New release</Alert.Title>
      <Alert.Description>
        A landmark named by its Title, for screen-reader navigation.
      </Alert.Description>
    </Alert.Root>
  )
}

export function TitleAsHeading() {
  return (
    <section aria-labelledby="sync-heading">
      <Heading id="sync-heading">Sync</Heading>
      <Heading.Level>
        <Alert.Root announce="off" data-tone="warning">
          <Alert.Title render={<Heading />}>Sync is paused</Alert.Title>
          <Alert.Description>Heading navigation finds it at level 3.</Alert.Description>
        </Alert.Root>
      </Heading.Level>
    </section>
  )
}

export function ErrorSummary() {
  const [errors, setErrors] = useState<readonly string[]>([])
  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setErrors(["Name is required", "Email is not valid"])
      }}
    >
      {errors.length > 0 && (
        <Alert.Root
          announce="assertive"
          data-tone="danger"
          announcement={`${errors.length} errors in the form. Fix them and submit again.`}
        >
          <Alert.Title>{errors.length} errors</Alert.Title>
          <Alert.Description>
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert.Description>
        </Alert.Root>
      )}
      <div className="row">
        <button type="submit">Submit</button>
      </div>
    </form>
  )
}

export function Closed() {
  const [open, setOpen] = useState(false)
  return (
    <div className="stack">
      <Alert.Root open={open} onOpenChange={setOpen}>
        <Alert.Title>Shown again</Alert.Title>
        <Alert.CloseTrigger>Dismiss</Alert.CloseTrigger>
      </Alert.Root>
      <div className="row">
        <button type="button" onClick={() => setOpen(true)} disabled={open}>
          Show
        </button>
      </div>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Static banner",
    description: 'Present at load and unchanging: `announce="off"`, no live region.',
  },
  ErrorAfterAction: {
    title: "Error after an action",
    description:
      '`announce="assertive"`: one announcement, "Error. Couldn\'t save. The disk is full." Dismissing moves focus to Retry.',
  },
  StatusUpdates: {
    title: "Status that updates",
    description: "Polite by default: each new text is announced once.",
  },
  Dismissible: {
    title: "Dismissible",
    description:
      '`onOpenChange(false, { reason: "close-trigger" })`; focus moves to the next control.',
  },
  Tones: { title: "Tones", description: "`data-tone` recolours it; the severity is in the text." },
  Region: {
    title: "Region recipe",
    description: '`role="region"` named by the Title\'s id: `alert-<id>-title`.',
  },
  TitleAsHeading: {
    title: "Title as a heading",
    description: "`render={<Heading />}`: the level follows `Heading.Level`.",
  },
  ErrorSummary: {
    title: "Error summary",
    description: "`announcement` says what the visible summary means; the alert takes no focus.",
  },
  Closed: { title: "Closed", description: "Controlled and closed.", hidden: true },
}
