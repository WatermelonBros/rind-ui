import { type PresenceEnv, presenceMachine, waitForExit } from "@rind-ui/core"
import { untrack } from "svelte"
import { useMachine } from "./use-machine.svelte"

export interface PresenceOptions {
  /** Stay mounted while closed (animation libraries, hidden content): never absent. */
  readonly keepMounted?: () => boolean
  /** Wait for descendants' animations too. */
  readonly subtree?: () => boolean
  /** The exit finished (the part is absent). */
  readonly onExitComplete?: () => void
}

/**
 * A part's presence: mounted while open and while its exit animations run (read on `el()`
 * once the closed state is applied). Read `.mounted` and `.state`.
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
  const machine = useMachine(presenceMachine, () => ({}), env)
  $effect(() =>
    machine.service.subscribe(() => {
      if (machine.service.getSnapshot().state === "absent") options.onExitComplete?.()
    }),
  )
  // After useMachine's start and after the closed state is in the DOM, when the exit
  // animations can be read.
  $effect(() => {
    const o = open()
    untrack(() => machine.send({ type: o ? "OPEN" : "CLOSE" }))
  })
  const state = $derived(
    machine.view.matches("present")
      ? "present"
      : machine.view.matches("exiting")
        ? "exiting"
        : "absent",
  )
  return {
    // Rendering open is mounted at once (also on the server, before the machine starts).
    get mounted() {
      return open() || state !== "absent" || options.keepMounted?.() === true
    },
    get state() {
      return state
    },
  }
}
