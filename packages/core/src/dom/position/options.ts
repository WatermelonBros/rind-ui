// Options, the presets every component family starts from, and logical → physical sides.

import type {
  Align,
  CollisionPadding,
  LogicalSide,
  PositioningOptions,
  PositioningProps,
  Side,
} from "../../env/position"

const base = {
  sideOffset: 0,
  alignOffset: 0,
  collisionPadding: 8,
  sticky: false,
  arrowPadding: 0,
  strategy: "auto",
  tracking: "auto",
  inline: false,
  mode: "auto",
} as const satisfies Partial<PositioningOptions>

/** Defaults per component family (design §4). */
export const positioningPresets = {
  /** Popover, Hover Card, Tooltip (side top), pickers, Tour. */
  popup: {
    ...base,
    side: "bottom",
    align: "center",
    collisionAvoidance: { side: "flip", align: "flip", fallbackAxis: "end" },
    sideLock: "none",
  },
  /** Select, Combobox, Menu, Navigation Menu: lists cap their height instead. */
  dropdown: {
    ...base,
    side: "bottom",
    align: "start",
    collisionAvoidance: { side: "flip", align: "shift", fallbackAxis: "none" },
    sideLock: "open",
  },
  /** Menu and Context Menu submenus. */
  submenu: {
    ...base,
    side: "inline-end",
    align: "start",
    collisionAvoidance: { side: "flip", align: "shift", fallbackAxis: "none" },
    sideLock: "none",
  },
  /** Context Menu root, at a point anchor. */
  pointer: {
    ...base,
    side: "right",
    align: "start",
    collisionAvoidance: { side: "flip", align: "flip", fallbackAxis: "none" },
    sideLock: "none",
    tracking: "none",
  },
} as const satisfies Record<string, PositioningOptions>

/** The component's defaults with the consumer's props over them (undefined props ignored). */
export function resolvePositioning(
  props: PositioningProps | undefined,
  defaults: PositioningOptions,
): PositioningOptions {
  if (!props) return defaults
  const defined = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined))
  // Only PositioningOptions keys with their own value types can be present (PositioningProps).
  return { ...defaults, ...defined } as PositioningOptions
}

/** `inline-start` / `inline-end` resolved against the direction. */
export function physicalSide(side: LogicalSide, dir: "ltr" | "rtl"): Side {
  if (side === "inline-start") return dir === "rtl" ? "right" : "left"
  if (side === "inline-end") return dir === "rtl" ? "left" : "right"
  return side
}

/** Floating UI's placement string. */
export const placementOf = (side: Side, align: Align) =>
  align === "center" ? side : (`${side}-${align}` as const)

/** Collision padding per side. */
export function paddingOf(p: CollisionPadding): Record<Side, number> {
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p }
  return { top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0 }
}

/** Rounds a CSS px value to the device-pixel grid. */
export const snap = (value: number, dpr: number) => Math.round(value * dpr) / dpr
