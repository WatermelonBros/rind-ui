// The shared presence of a part that can animate out: present → exiting → absent. Closing
// never waits for it (the layer, focus and locks are released at close); it only keeps the
// node mounted while `waitForExit` (an injected effect, cancelled by OPEN) runs.

import { setup, type } from "../machine"

export type PresenceEvent = { type: "OPEN" } | { type: "CLOSE" } | { type: "EXIT_DONE" }

export interface PresenceEnv {
  readonly presence: {
    /** Resolves when the part's exit animations are done (core/dom/presence.ts). */
    waitForExit(signal: AbortSignal): Promise<void>
  }
}

export const presenceMachine = /* @__PURE__ */ setup({
  types: type<{ props: object; events: PresenceEvent; env: PresenceEnv }>(),
  effects: {
    waitForExit: ({ env, send }) => {
      const controller = new AbortController()
      void env.presence.waitForExit(controller.signal).then(() => {
        if (!controller.signal.aborted) send({ type: "EXIT_DONE" })
      })
      // Re-opening during the exit cancels the pending unmount (same node kept).
      return () => controller.abort()
    },
  },
}).machine({
  id: "presence",
  initial: "absent",
  states: {
    absent: { on: { OPEN: "present" } },
    present: { on: { CLOSE: "exiting" } },
    exiting: {
      effects: ["waitForExit"],
      on: { OPEN: "present", EXIT_DONE: "absent" },
    },
  },
})

export type PresenceMachine = typeof presenceMachine
