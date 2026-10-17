"use client"

import { createToaster, type Toaster as ToasterStore } from "@rind-ui/core"
import { Toast, Toaster } from "@rind-ui/react"
import { useEffect } from "react"
import type { States, Variants } from "./types"

// The toaster contract's states (collapsed, expanded) share the scope with the toast's own.
export const states: States = {
  toast: {
    collapsed: "Open",
    expanded: "Expanded",
    // Timers start when the region mounts, so these three are held by their data: an hour
    // of time, an action without a duration, and the api pause reason.
    timing: "Open",
    persistent: "Open",
    paused: "Open",
  },
}

/** One store per example: two regions on the same store would show every toast twice. */
function View({
  store,
  name,
  inline = false,
}: {
  store: ToasterStore
  /** A distinct region name per example: one page shows several (landmark-unique). */
  name: string
  /** In the example itself (state examples), not the page's corner. */
  inline?: boolean
}) {
  return (
    <Toaster
      toaster={store}
      portal={!inline}
      messages={{ regionLabel: (key) => `${name} notifications (${key})` }}
    >
      {(t) => (
        <Toast.Root>
          <Toast.Title />
          {t.data.description ? <Toast.Description /> : null}
          {t.data.action ? <Toast.ActionTrigger /> : null}
          <Toast.CloseTrigger>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Toast.CloseTrigger>
        </Toast.Root>
      )}
    </Toaster>
  )
}

const basic = createToaster()

export function Basic() {
  return (
    <>
      <button type="button" onClick={() => basic.show("Changes saved")}>
        Save
      </button>
      <View store={basic} name="Basic" />
    </>
  )
}

const typed = createToaster({ limit: 5 })

export function Types() {
  return (
    <>
      <div className="row">
        <button type="button" onClick={() => typed.info("New version available")}>
          Info
        </button>
        <button type="button" onClick={() => typed.success("Profile updated")}>
          Success
        </button>
        <button type="button" onClick={() => typed.warning("Storage almost full")}>
          Warning
        </button>
        <button type="button" onClick={() => typed.error("Upload failed")}>
          Error
        </button>
      </div>
      <View store={typed} name="Types" />
    </>
  )
}

const withAction = createToaster()

export function Action() {
  return (
    <>
      <button
        type="button"
        onClick={() =>
          withAction.show({
            id: "archived",
            title: "Message archived",
            action: { label: "Undo", onAction: () => withAction.success("Message restored") },
          })
        }
      >
        Archive
      </button>
      <View store={withAction} name="Action" />
    </>
  )
}

const promised = createToaster()

export function Promised() {
  return (
    <>
      <button
        type="button"
        onClick={() =>
          promised.promise(
            new globalThis.Promise<string>((done) => setTimeout(done, 1500, "report.pdf")),
            {
              loading: "Exporting…",
              success: (name) => `Exported ${name}`,
              error: "Export failed",
            },
          )
        }
      >
        Export
      </button>
      <View store={promised} name="Promise" />
    </>
  )
}

const limited = createToaster({ limit: 2, duration: Number.POSITIVE_INFINITY })

let shown = 0

export function Limit() {
  return (
    <>
      <button
        type="button"
        onClick={() => {
          shown += 1
          limited.show({
            title: `Notification ${shown}`,
            description: "Held when beyond the limit.",
          })
        }}
      >
        Notify
      </button>
      <button type="button" onClick={() => limited.dismiss()}>
        Clear
      </button>
      <View store={limited} name="Limit" />
    </>
  )
}

const open = createToaster()

/** Shown on mount: the three live states of a toast, collapsed. */
export function Open() {
  useEffect(() => {
    // ids: a repeated effect (strict mode) updates them instead of stacking more.
    open.show({ id: "open-timing", title: "Sync finished", duration: 3_600_000 })
    open.show({
      id: "open-persistent",
      title: "Message archived",
      action: { label: "Undo", onAction: () => {} },
    })
    open.pause(open.show({ id: "open-paused", title: "Upload held", duration: 3_600_000 }))
  }, [])
  return <View store={open} name="Open" inline />
}

const expanded = createToaster({ expand: true, duration: Number.POSITIVE_INFINITY })

export function Expanded() {
  useEffect(() => {
    expanded.show({ id: "expanded-1", title: "First", description: "Oldest." })
    expanded.show({ id: "expanded-2", title: "Second" })
    expanded.show({ id: "expanded-3", title: "Third", description: "Newest." })
  }, [])
  return <View store={expanded} name="Expanded" inline />
}

export const variants: Variants = {
  Basic: { title: "Basic", description: "`toaster.show(…)` from a click handler." },
  Types: {
    title: "Types",
    description: "`info`, `success`, `warning` and `error`: styling only, the title says it all.",
  },
  Action: {
    title: "Action",
    description: "An action without a `duration` persists (WCAG 2.2.1) until Undo or dismissed.",
  },
  Promised: {
    title: "Promise",
    description: "`toaster.promise(…)`: loading, then success or error.",
  },
  Limit: {
    title: "Limit",
    description: "`limit: 2`: older toasts are held, not dropped; they show as others go.",
  },
  Open: {
    title: "Open",
    description: "Toasts shown on mount: timing, persistent and paused, in the collapsed stack.",
  },
  Expanded: { title: "Expanded", description: "`expand: true`: every toast at full size." },
}
