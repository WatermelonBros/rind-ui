// Test-only layer fixture (add-overlay-infrastructure): a minimal overlay whose open state
// runs the overlay effect, so the infrastructure is exercised end to end. Not published.
import {
  type ChangeDetails,
  type DismissReason,
  type DomEnvironment,
  type LayerId,
  layerId,
  overlayEffect,
  partId,
  setup,
  type,
} from "@rind-ui/core"

export type CloseReason = DismissReason | "close-button"

export type LayerEvent =
  | { type: "OPEN" }
  | { type: "CLOSE"; reason?: CloseReason }
  | { type: "TOGGLE" }

export interface LayerProps {
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: ChangeDetails<LayerEvent>) => void) | undefined
  /** Default true. */
  readonly modal?: boolean | undefined
  /**
   * Default "dialog". A "menu" registers its trigger among its elements and is named by it,
   * as a modal menu does: the trigger stays exposed (RA#9737) and pressing it is not outside.
   */
  readonly kind?: "dialog" | "menu" | undefined
  /** The instance's root id (part ids derive from it). */
  readonly root: string
  /** The layer this one was opened from (the adapter's layer context). */
  readonly parent?: LayerId | undefined
}

export const layerIdOf = (root: string) => layerId(`layer-${root}`)

export const layerMachine = setup({
  types: type<{
    props: LayerProps
    events: LayerEvent
    env: DomEnvironment
    values: "open"
  }>(),
  effects: {
    overlay: ({ env, props, send }) => {
      const byId = (part: string) => env.dom.getById(partId("layer", props.root, part))
      const content = () => byId("content") as HTMLElement | null
      let closed = false
      const modal = props.modal !== false
      // A non-modal layer's trigger is part of it too: pressing it toggles, it is not outside.
      const ownsTrigger = props.kind === "menu" || !modal
      const stop = overlayEffect(env, {
        id: layerIdOf(props.root),
        kind: props.kind ?? "dialog",
        modal,
        parent: props.parent,
        opener: () => byId("trigger"),
        elements: () =>
          [
            ownsTrigger ? byId("trigger") : null,
            byId("positioner"),
            byId("backdrop"),
            content(),
          ].filter((e) => e !== null),
        surfaces: () => [byId("positioner"), byId("backdrop")].filter((e) => e !== null),
        container: content,
        modality: env.modality.modality(),
        dismiss: {
          onRequest: (request) => {
            send({ type: "CLOSE", reason: request.reason })
            // A controlled parent that kept it open vetoes: nothing beneath is dismissed.
            if (!closed) request.cancel()
          },
        },
      })
      return () => {
        closed = true
        stop()
      }
    },
  },
}).machine({
  id: "layer",
  initial: "closed",
  values: { open: { fallback: false, states: { open: true, closed: false } } },
  states: {
    closed: { on: { OPEN: "open", TOGGLE: "open" } },
    open: {
      effects: ["overlay"],
      on: { CLOSE: "closed", TOGGLE: "closed" },
    },
  },
})

export type LayerMachine = typeof layerMachine
