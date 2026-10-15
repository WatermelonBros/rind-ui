// Test-only anchored popup (add-floating-positioning): a non-modal popover placed by the
// `position` capability. Initial focus waits for the first placement (visible in the graph:
// POSITION.PLACED with `first`). Not published (Popover gets its own change).
import {
  type Align,
  type ChangeDetails,
  type DomEnvironment,
  focusSafely,
  layerId,
  overlayEffect,
  type PlacementState,
  type PositionEnv,
  type PositioningOptions,
  type PositioningProps,
  partId,
  placementFrom,
  positioningPresets,
  resolvePositioning,
  type Side,
  setup,
  tabbables,
  type,
  unplaced,
  type VirtualAnchor,
} from "@rind-ui/core"

export type AnchoredEvent =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "TOGGLE" }
  | {
      type: "POSITION.PLACED"
      side: Side
      align: Align
      anchorHidden: boolean
      first: boolean
    }
  | { type: "POSITION.REPOSITION" }

export type AnchoredPreset = keyof typeof positioningPresets

export interface AnchoredProps {
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<AnchoredEvent>) => void)
    | undefined
  /** The instance's root id (part ids derive from it). */
  readonly root: string
  /** The family defaults (default `popup`). */
  readonly preset?: AnchoredPreset | undefined
  readonly positioning?: PositioningProps | undefined
  /** Anchor somewhere other than the trigger: a viewport point or a virtual rectangle. */
  readonly anchor?:
    | { readonly x: number; readonly y: number }
    | { readonly get: () => VirtualAnchor | null }
    | undefined
  /** The fixture renders an arrow part. */
  readonly arrow?: boolean | undefined
}

export const anchoredIds = (root: string) => ({
  trigger: partId("anchored", root, "trigger"),
  positioner: partId("anchored", root, "positioner"),
  content: partId("anchored", root, "content"),
  arrow: partId("anchored", root, "arrow"),
})

export const optionsOf = (props: AnchoredProps): PositioningOptions =>
  resolvePositioning(props.positioning, positioningPresets[props.preset ?? "popup"])

export const anchoredMachine = setup({
  types: type<{
    props: AnchoredProps
    events: AnchoredEvent
    env: DomEnvironment & PositionEnv
    context: { placement: PlacementState }
    values: "open"
  }>(),
  effects: {
    /** Dismissal, outside hiding and focus restore; initial focus is ours (after placement). */
    overlay: ({ env, props, send }) => {
      const ids = anchoredIds(props.root)
      return overlayEffect(env, {
        id: layerId(`anchored-${props.root}`),
        kind: "popover",
        modal: false,
        opener: () => env.dom.getById(ids.trigger),
        elements: () =>
          [env.dom.getById(ids.trigger), env.dom.getById(ids.positioner)].filter((e) => e !== null),
        container: () => env.dom.getById(ids.content),
        initialFocus: () => false,
        modality: env.modality.modality(),
        dismiss: { onRequest: () => send({ type: "CLOSE" }) },
      })
    },
    trackPosition: ({ env, props, send }) => {
      const ids = anchoredIds(props.root)
      const a = props.anchor
      const handle = env.position.track({
        anchor: !a
          ? { kind: "element", id: ids.trigger }
          : "x" in a
            ? { kind: "point", x: a.x, y: a.y }
            : { kind: "virtual", get: a.get },
        positioner: ids.positioner,
        arrow: props.arrow ? ids.arrow : undefined,
        options: () => optionsOf(props),
        onPlacement: (p, first) => send({ type: "POSITION.PLACED", ...p, first }),
      })
      return () => handle.stop()
    },
  },
  actions: {
    setPlacement: ({ event, set }) => {
      if (event.type === "POSITION.PLACED") set("placement", placementFrom(event))
    },
    resetPlacement: ({ props, set }) => {
      const o = optionsOf(props)
      // The requested side until placed (physical: inline sides resolve on placement).
      const side = o.side === "inline-start" ? "left" : o.side === "inline-end" ? "right" : o.side
      set("placement", unplaced(side, o.align))
    },
    /** Placed before focus: the first tab stop of the content, else the content itself. */
    focusContent: ({ env, props }) => {
      const content = env.dom.getById(anchoredIds(props.root).content)
      if (!content) return
      void focusSafely(tabbables(content)[0] ?? content, env, "layer")
    },
    reposition: ({ env, props }) => env.position.reposition(anchoredIds(props.root).positioner),
  },
  guards: {
    firstPlacement: ({ event }) => event.type === "POSITION.PLACED" && event.first,
  },
}).machine({
  id: "anchored",
  initial: "closed",
  context: (props) => {
    const o = optionsOf(props)
    const side = o.side === "inline-start" ? "left" : o.side === "inline-end" ? "right" : o.side
    return { placement: unplaced(side, o.align) }
  },
  values: { open: { fallback: false, states: { open: true, closed: false } } },
  states: {
    closed: { entry: ["resetPlacement"], on: { OPEN: "open", TOGGLE: "open" } },
    open: {
      effects: ["overlay", "trackPosition"],
      on: {
        CLOSE: "closed",
        TOGGLE: "closed",
        "POSITION.PLACED": [
          { guard: "firstPlacement", actions: ["setPlacement", "focusContent"] },
          { actions: ["setPlacement"] },
        ],
        "POSITION.REPOSITION": { actions: ["reposition"] },
      },
    },
  },
})

export type AnchoredMachine = typeof anchoredMachine
