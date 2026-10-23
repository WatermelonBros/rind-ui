import type { avatarConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { ImageHost } from "../image-status.svelte"
import type { AvatarState } from "./types"

export const avatarContext = createContext<{
  readonly api: () => ReturnType<typeof avatarConnect>
  readonly host: ImageHost
  readonly state: () => AvatarState
  readonly fallback: () => boolean
  readonly name: () => string | undefined
}>("avatar")
