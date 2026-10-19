import { type ComponentType, createElement, type ReactNode } from "react"
import { useIcon } from "./provider"

/** The icon names of the theme's token set (`--rind-icon-<name>`), swappable per provider. */
export type IconName =
  | "check"
  | "minus"
  | "x"
  | "caret-down"
  | "caret-up"
  | "caret-left"
  | "caret-right"
  | "magnifying-glass"
  | "eye"
  | "eye-slash"
  | "plus"
  | "calendar"
  | "clock"
  | "warning"
  | "info"
  | "check-circle"
  | "x-circle"
  | "dots-three"
  | "arrow-left"
  | "arrow-right"
  | "copy"
  | "arrow-up"
  | "stop"
  | "paperclip"
  | "caret-up-down"
  | "funnel"
  | "funnel-simple"
  | "arrows-out"
  | "arrows-in"

/** Icon components by name, as accepted by `RindProvider icons`. */
export type RindIcons = Partial<Record<IconName, ComponentType>>

/**
 * What an indicator part renders: the consumer's children, else the provider's icon for
 * `name`, else nothing (the theme's CSS token draws the default). A hook: call it in the part.
 */
export function useIconChildren(name: IconName, children?: ReactNode): ReactNode {
  const Icon = useIcon(name)
  if (children !== undefined && children !== null) return children
  return Icon ? createElement(Icon) : null
}
