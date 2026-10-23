import { type Component, h, type VNodeChild } from "vue"
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
  | "arrow-down"
  | "stop"
  | "paperclip"
  | "caret-up-down"
  | "funnel"
  | "funnel-simple"
  | "arrows-out"
  | "arrows-in"
  | "pause"
  | "play"

/** Icon components by name, as accepted by `RindProvider :icons`. */
export type RindIcons = Partial<Record<IconName, Component>>

/**
 * What an indicator part renders: the consumer's slot content, else the provider's icon for
 * `name`, else nothing (the theme's CSS token draws the default). Call it in setup.
 */
export function useIconChildren(name: IconName) {
  const icon = useIcon(name)
  return (children: VNodeChild | undefined): VNodeChild => {
    if (children !== undefined && children !== null) return children
    return icon.value ? h(icon.value) : null
  }
}
