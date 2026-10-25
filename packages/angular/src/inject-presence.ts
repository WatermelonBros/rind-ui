import {
  afterNextRender,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  type Signal,
  untracked,
} from "@angular/core"
import { type PresenceEnv, presenceMachine, waitForExit } from "@rind-ui/core"
import { injectMachine } from "./inject-machine"

export interface Presence {
  /** Rendered: while open and while its exit animations run. */
  readonly mounted: Signal<boolean>
  readonly state: Signal<"present" | "exiting" | "absent">
}

/**
 * A part's presence: rendered while open and while its exit animations run (read on `el` once
 * the closed state is applied). Absent, the part writes `absentProps` (React renders nothing).
 */
export interface PresenceOptions {
  /** Stays rendered while closed (animation libraries, hidden content): never absent. */
  readonly keepMounted?: () => boolean
  /** Waits for descendants' animations too. */
  readonly subtree?: () => boolean
  /** The exit finished (the part is absent). */
  readonly onExitComplete?: () => void
}

export function injectPresence(
  open: () => boolean,
  el: Element,
  options: PresenceOptions = {},
): Presence {
  const env: PresenceEnv = {
    presence: {
      waitForExit: (signal) => waitForExit(el, { subtree: options.subtree?.() === true }, signal),
    },
  }
  const { view, send, service } = injectMachine(presenceMachine, () => ({}), env)
  if (inject(PLATFORM_ID) === "browser") {
    // The machine starts after the first render: the state then, and every change after it
    // (once the closed state is applied, which is when the exit animations can be read).
    let started = false
    afterNextRender(() => {
      started = true
      if (options.onExitComplete) {
        const done = options.onExitComplete
        service().subscribe(() => {
          if (service().getSnapshot().state === "absent") done()
        })
      }
      send({ type: untracked(open) ? "OPEN" : "CLOSE" })
    })
    effect(() => {
      const o = open()
      if (started) untracked(() => send({ type: o ? "OPEN" : "CLOSE" }))
    })
  }
  const state = computed(() =>
    view().matches("present") ? "present" : view().matches("exiting") ? "exiting" : "absent",
  )
  // Rendering open is rendered at once (also on the server, before the machine starts).
  const mounted = computed(() => open() || state() !== "absent" || options.keepMounted?.() === true)
  return { mounted, state }
}
