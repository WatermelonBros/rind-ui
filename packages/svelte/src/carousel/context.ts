import type { CarouselEvent, carouselConnect, ItemRegistry } from "@rind-ui/core"
import { createContext } from "../context"
import type { CarouselRenderState } from "./types"

export const carouselContext = createContext<{
  readonly api: () => ReturnType<typeof carouselConnect>
  readonly send: (event: CarouselEvent) => void
  readonly state: () => CarouselRenderState
  readonly registry: ItemRegistry
  readonly viewport: { current: HTMLElement | null }
  readonly orientation: () => "horizontal" | "vertical"
  readonly dir: () => "ltr" | "rtl"
  readonly onScroll: () => void
}>("carousel")
