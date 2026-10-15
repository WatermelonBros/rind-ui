// Reference fixture for the foundation tests. Not a public component: Collapsible gets its
// own change.
import { type ChangeDetails, type DomEnv, type SchedulerEnv, setup, type } from "@rind-ui/core"

export type DisclosureEvent =
  | { type: "OPEN"; reason?: "find-in-page" }
  | { type: "CLOSE" }
  | { type: "TOGGLE" }
  | { type: "ESCAPE" }

export interface DisclosureProps {
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<DisclosureEvent>) => void)
    | undefined
  /** Escape closes the content (default true). */
  readonly closeOnEscape?: boolean | undefined
  /** Closes by itself after this many ms. */
  readonly autoCloseMs?: number | undefined
  /** Closed content stays mounted with hidden="until-found" (find-in-page opens it). */
  readonly hiddenUntilFound?: boolean | undefined
}

export const disclosureMachine = setup({
  types: type<{
    props: DisclosureProps
    events: DisclosureEvent
    env: DomEnv & SchedulerEnv
    values: "open"
    context: { revealed: boolean }
  }>(),
  actions: {
    // data-reveal="find-in-page" for the opening transition only, so the theme skips its
    // animation for a find-in-page reveal.
    markReveal: ({ event, set }) =>
      set("revealed", event.type === "OPEN" && event.reason === "find-in-page"),
    clearReveal: ({ set }) => set("revealed", false),
  },
  guards: {
    closeOnEscape: ({ props }) => props.closeOnEscape !== false,
    autoCloses: ({ props }) => props.autoCloseMs !== undefined,
  },
  effects: {
    listenEscape: ({ env, send }) => {
      const root = env.dom.getRootNode()
      const onKeyDown = (event: Event) => {
        if ((event as KeyboardEvent).key === "Escape") send({ type: "ESCAPE" })
      }
      root.addEventListener("keydown", onKeyDown)
      return () => root.removeEventListener("keydown", onKeyDown)
    },
  },
  delays: { autoClose: ({ props }) => props.autoCloseMs ?? 0 },
}).machine({
  id: "disclosure",
  initial: "closed",
  context: () => ({ revealed: false }),
  values: { open: { fallback: false, states: { open: true, closed: false } } },
  states: {
    closed: {
      entry: ["clearReveal"],
      on: { OPEN: { target: "open", actions: ["markReveal"] }, TOGGLE: "open" },
    },
    open: {
      effects: ["listenEscape"],
      after: { autoClose: { target: "closed", guard: "autoCloses" } },
      on: {
        CLOSE: "closed",
        TOGGLE: "closed",
        ESCAPE: { target: "closed", guard: "closeOnEscape" },
      },
    },
  },
})

export type DisclosureMachine = typeof disclosureMachine
