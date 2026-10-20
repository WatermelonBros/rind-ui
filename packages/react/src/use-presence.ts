"use client"

import { type PresenceEnv, presenceMachine, waitForExit } from "@rind-ui/core"
import { type RefObject, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { useMachine } from "./use-machine"

export interface PresenceOptions {
  /** Stay mounted while closed (animation libraries, hidden content): never absent. */
  readonly keepMounted?: boolean
  /** Wait for descendants' animations too. */
  readonly subtree?: boolean
  /** The exit finished (the part is absent). */
  readonly onExitComplete?: () => void
}

/**
 * A part's presence: mounted while open and while its exit animations run (read on `ref`
 * once the closed state is applied). The unmount is committed synchronously when the exit
 * ends, so no frame paints the resting style in between (mui/base-ui#979).
 */
export function usePresence(
  open: boolean,
  ref: RefObject<Element | null>,
  options: PresenceOptions = {},
): { readonly mounted: boolean; readonly state: "present" | "exiting" | "absent" } {
  const latest = useRef(options)
  latest.current = options
  const env = useMemo<PresenceEnv>(
    () => ({
      presence: {
        waitForExit: (signal) =>
          ref.current
            ? waitForExit(ref.current, { subtree: latest.current.subtree === true }, signal)
            : Promise.resolve(),
      },
    }),
    [ref],
  )
  const { view, send, service } = useMachine(presenceMachine, {}, env)
  const [, commit] = useState(0)
  useEffect(
    () =>
      service.subscribe(() => {
        if (service.getSnapshot().state !== "absent") return
        flushSync(() => commit((n) => n + 1))
        latest.current.onExitComplete?.()
      }),
    [service],
  )
  // After useMachine's start (an earlier passive effect) and after the closed state is
  // committed, which is when the exit animations can be read.
  useEffect(() => {
    send({ type: open ? "OPEN" : "CLOSE" })
  }, [open, send])
  const state = view.matches("present") ? "present" : view.matches("exiting") ? "exiting" : "absent"
  // Rendering open is mounted at once (also on the server, before the machine starts).
  return { mounted: open || state !== "absent" || options.keepMounted === true, state }
}
