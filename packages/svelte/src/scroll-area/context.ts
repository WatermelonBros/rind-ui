import type { ScrollAreaConnectInput, scrollAreaConnect } from "@rind-ui/core"
import { createContext } from "../context"

export type Orientation = "vertical" | "horizontal"
type Connect = ReturnType<typeof scrollAreaConnect>
export const scrollAreaContext = createContext<{
  readonly connect: () => Connect
  readonly send: Parameters<Connect["root"]>[0]
  readonly input: () => ScrollAreaConnectInput
  readonly register: (o: Orientation) => () => void
  readonly bars: () => ReadonlySet<Orientation>
}>("scroll-area")
export const scrollbarOrientation = createContext<() => Orientation>("scroll-area-scrollbar")
