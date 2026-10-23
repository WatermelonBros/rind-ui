import { type PresenceEnv, presenceMachine, waitForExit } from "@rind-ui/core"
import { computed, onMounted, type Ref, watch } from "vue"
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
 * the closed state is applied). Read `.mounted` and `.state`.
 */
export function usePresence(
  open: () => boolean,
  el: Ref<Element | null>,
  options: PresenceOptions = {},
) {
  const env: PresenceEnv = {
    presence: {
      waitForExit: (signal) =>
        el.value
          ? waitForExit(el.value, { subtree: options.subtree?.() === true }, signal)
          : Promise.resolve(),
    },
  }
  const { view, send, service } = useMachine(presenceMachine, () => ({}), env)
  onMounted(() => {
    service.subscribe(() => {
      if (service.getSnapshot().state === "absent") options.onExitComplete?.()
    })
    // After useMachine's start and after the closed state is in the DOM (post flush), which is
    // when the exit animations can be read.
    watch(open, (o) => send({ type: o ? "OPEN" : "CLOSE" }), { immediate: true, flush: "post" })
  })
  const state = computed(() =>
    view.value.matches("present")
      ? "present"
      : view.value.matches("exiting")
        ? "exiting"
        : "absent",
  )
  return {
    // Rendering open is mounted at once (also on the server, before the machine starts).
    get mounted() {
      return open() || state.value !== "absent" || options.keepMounted?.() === true
    },
    get state() {
      return state.value
    },
  }
}
