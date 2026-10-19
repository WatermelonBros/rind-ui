// Table Frame (table-columns-and-toolbar design §4): the box around the Header, the Root and the
// Footer. `expanded` (controllable) shows it full page as a modal layer of the overlay stack:
// outside inert, scroll locked, Escape collapses it and focus goes back to the ExpandTrigger.
// Focus is not moved on expand (the user stays on the trigger).

import { layerId } from "../../dom/layer-stack"
import { overlayEffect } from "../../dom/overlay"
import type { DomEnvironment } from "../../env/dom-environment"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type TableFrameEvent =
  /** A press on the ExpandTrigger. */
  | { readonly type: "TOGGLE" }
  /** Escape while expanded (from the layer's dismissal). */
  | { readonly type: "escape-key" }

export interface TableFrameProps {
  /** The instance id: the Frame's and the ExpandTrigger's ids derive from it. */
  readonly root: string
  readonly expanded?: boolean | undefined
  readonly defaultExpanded?: boolean | undefined
  readonly onExpandedChange?:
    | ((expanded: boolean, details: ChangeDetails<TableFrameEvent>) => void)
    | undefined
}

export const tableFrameIds = (root: string) => ({
  frame: `table-frame-${root}`,
  expandTrigger: `table-frame-${root}-expand-trigger`,
})

export const tableFrameMachine = setup({
  types: type<{
    props: TableFrameProps
    events: TableFrameEvent
    env: DomEnvironment
    values: "expanded"
  }>(),
  effects: {
    /** The modal layer, while expanded. */
    layer: ({ env, props, send }) => {
      const ids = tableFrameIds(props.root)
      const frame = () => env.dom.getById(ids.frame)
      return overlayEffect(env, {
        id: layerId(ids.frame),
        kind: "dialog",
        family: "dialog",
        modal: true,
        elements: () => [frame()].filter((e): e is HTMLElement => e !== null),
        container: frame,
        // The user stays where they pressed (the trigger is inside the Frame).
        initialFocus: () => false,
        finalFocus: (reason) =>
          reason === "escape-key" ? env.dom.getById(ids.expandTrigger) : false,
        modality: env.modality.modality(),
        dismiss: {
          escape: true,
          outsidePress: false,
          outsideFocus: false,
          onRequest: (request) => {
            if (request.reason === "escape-key") send({ type: "escape-key" })
            else request.cancel()
          },
        },
      })
    },
  },
}).machine({
  id: "table-frame",
  initial: "collapsed",
  values: { expanded: { fallback: false, states: { expanded: true, collapsed: false } } },
  states: {
    collapsed: { on: { TOGGLE: "expanded" } },
    expanded: {
      effects: ["layer"],
      on: { TOGGLE: "collapsed", "escape-key": "collapsed" },
    },
  },
})

export type TableFrameMachine = typeof tableFrameMachine
