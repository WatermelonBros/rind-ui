// The positioning capability: machines place anchored popups only through it, from an
// effect scoped to their open state. Discrete results (side, align, anchor hidden, first
// placement) come back through `onPlacement`; coordinates and sizes go straight to CSS.
// Not part of domEnvironment(): only anchored components carry the engine.

export type Side = "top" | "right" | "bottom" | "left"
export type LogicalSide = Side | "inline-start" | "inline-end"
export type Align = "start" | "center" | "end"

export interface Placement {
  /** The physical side the popup was placed on. */
  readonly side: Side
  readonly align: Align
  readonly anchorHidden: boolean
}

/** A rectangle in viewport coordinates. */
export interface RectLike {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly top: number
  readonly left: number
  readonly right: number
  readonly bottom: number
}

/** A rectangle-like anchor (a map marker, a text selection). */
export interface VirtualAnchor {
  getBoundingClientRect(): RectLike
  /** Line boxes, for `inline`. */
  getClientRects?(): RectLike[]
  /** The element whose clipping ancestors and scroll parents the anchor belongs to. */
  readonly contextElement?: Element
}

export type AnchorSource =
  /** An element, by id (the component's trigger or control). */
  | { readonly kind: "element"; readonly id: string }
  | { readonly kind: "virtual"; readonly get: () => VirtualAnchor | null }
  /** A viewport point, a 0 × 0 rectangle (a context menu at the pointer). */
  | { readonly kind: "point"; readonly x: number; readonly y: number }

export interface CollisionAvoidance {
  readonly side: "flip" | "shift" | "none"
  readonly align: "flip" | "shift" | "none"
  /** Where a popup goes when neither side on its axis fits. */
  readonly fallbackAxis: "start" | "end" | "none"
}

export type CollisionPadding = number | Partial<Record<Side, number>>

export interface PositioningOptions {
  readonly side: LogicalSide
  readonly align: Align
  readonly sideOffset: number
  readonly alignOffset: number
  readonly collisionPadding: CollisionPadding
  /** Default: the floating element's clipping ancestors (and the viewport). */
  readonly collisionBoundary?: Element | (() => Element | null) | undefined
  readonly collisionAvoidance: CollisionAvoidance
  /** Shifting may move the popup over its anchor on the side axis. */
  readonly sticky: boolean
  readonly arrowPadding: number
  readonly strategy: "auto" | "absolute" | "fixed"
  readonly tracking: "auto" | "frame" | "none"
  /** `open`: the first placement's side and align are kept until close. */
  readonly sideLock: "none" | "open"
  /** An anchor wrapping across lines: placed against the line nearest this point. */
  readonly inline: boolean | { readonly x: number; readonly y: number }
  /** `manual`: no coordinates written (CSS anchor positioning by the consumer). */
  readonly mode: "auto" | "manual"
}

/** A consumer's positioning props: any option, over the component's defaults. */
export type PositioningProps = { readonly [K in keyof PositioningOptions]?: PositioningOptions[K] }

export interface PositionRequest {
  readonly anchor: AnchorSource
  /** The positioner element's id. */
  readonly positioner: string
  /** The arrow element's id, when the component has one. */
  readonly arrow?: string | undefined
  /** Read live on every pass. */
  readonly options: () => PositioningOptions
  /** First placement of this open, then only when side, align or anchorHidden change. */
  readonly onPlacement: (placement: Placement, first: boolean) => void
}

export interface PositionHandle {
  reposition(): void
  stop(): void
}

export interface Positioning {
  track(request: PositionRequest): PositionHandle
  /** Repositions the tracking that owns this positioner (a moving virtual anchor). */
  reposition(positioner: string): void
}

export interface PositionEnv {
  readonly position: Positioning
}
