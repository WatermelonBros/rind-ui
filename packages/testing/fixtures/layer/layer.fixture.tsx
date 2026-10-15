import type { ReactNode } from "react"
import { Layer, type RootProps } from "./layer.react"

/** A modal layer: trigger, portalled backdrop + content with a title, a field and close. */
export function LayerExample({
  label = "Open",
  title = "Settings",
  children,
  ...props
}: RootProps & { label?: string; title?: string; children?: ReactNode }) {
  return (
    <Layer.Root {...props}>
      <Layer.Trigger>{label}</Layer.Trigger>
      <Layer.Portal>
        <Layer.Backdrop />
        <Layer.Positioner>
          <Layer.Content>
            <Layer.Title>{title}</Layer.Title>
            <input aria-label="Name" />
            {children}
            <Layer.Close>Close</Layer.Close>
          </Layer.Content>
        </Layer.Positioner>
      </Layer.Portal>
    </Layer.Root>
  )
}
