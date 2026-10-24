/** @jsxImportSource solid-js */
import { type Component, type JSX, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
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

/** Icon components by name, as accepted by `<RindProvider icons>`. */
export type RindIcons = Partial<Record<IconName, Component>>

/**
 * What an indicator part renders: the consumer's children, else the provider's icon for
 * `name`, else nothing (the theme's CSS token draws the default).
 */
export function IconChildren(props: { name: IconName; children?: JSX.Element }) {
  const icon = useIcon(props.name)
  return (
    <Show when={props.children === undefined || props.children === null} fallback={props.children}>
      <Show when={icon()}>{(c) => <Dynamic component={c()} />}</Show>
    </Show>
  )
}
