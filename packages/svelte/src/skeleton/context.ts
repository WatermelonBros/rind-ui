import type { SkeletonMessages, skeletonConnect } from "@rind-ui/core"
import { createContext } from "../context"

export const skeletonContext = createContext<{
  readonly connect: () => ReturnType<typeof skeletonConnect>
  readonly messages: () => SkeletonMessages
  readonly loading: () => boolean
}>("skeleton")
