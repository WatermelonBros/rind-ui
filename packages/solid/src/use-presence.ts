import { type PresenceEnv, presenceMachine, waitForExit } from "@rind-ui/core"
import { createEffect, on } from "solid-js"
import { afterMount } from "./lifecycle"
import { useMachine } from "./use-machine"

export interface PresenceOptions {
  /** Stay mounted while closed (animation libraries, hidden content): never absent. */
  readonly keepMounted?: () => boolean
  /** Wait for descendants' animations too. */
  readonly subtree?: () => boolean
  /** The exit finished (the part is absent). */
  readonly onExitComplete?: () => void
}

/**
 * A part's presence: mounted while open and while its exit animations run (read on `el` once
 * the closed state is applied). Read `mounted()` and `state()`.
 */
export function usePresence(
  open: () => boolean,
  el: () => Element | null,
  options: PresenceOptions = {},
) {
  const env: PresenceEnv = {
    presence: {
      waitForExit: (signal) => {
        const node = el()
        return node
          ? waitForExit(node, { subtree: options.subtree?.() === true }, signal)
          : Promise.resolve()
      },
    },
  }
  const { view, send, service } = useMachine(presenceMachine, () => ({}), env)
  afterMount(() => {
    service.subscribe(() => {
      if (service.getSnapshot().state === "absent") options.onExitComplete?.()
    })
    // Created inside the mount callback, so it runs after useMachine's start and after the
    // closed state is in the DOM (effects follow render effects): the exit animations can be read.
    createEffect(on(open, (o) => send({ type: o ? "OPEN" : "CLOSE" })))
  })
  const state = (): "present" | "exiting" | "absent" =>
    view().matches("present") ? "present" : view().matches("exiting") ? "exiting" : "absent"
  return {
    // Rendering open is mounted at once (also on the server, before the machine starts).
    mounted: () => open() || state() !== "absent" || options.keepMounted?.() === true,
    state,
  }
}
