import type { KbdKeys, KbdMessages, MessageOverrides } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    kbd: KbdMessages
  }
}

/** What every part's snippets receive. */
export interface KbdRenderState {
  readonly platform: "apple" | "other"
}

export type KbdRootProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  /** "mod+shift+p" (a chord), "g i" (a sequence), or one chord's key names. */
  readonly keys?: KbdKeys | undefined
  /** Overrides the environment's platform. */
  readonly platform?: "apple" | "other" | undefined
  readonly messages?: MessageOverrides<KbdMessages> | undefined
  readonly child?: Snippet<[ChildArgs<KbdRenderState>]> | undefined
  readonly children?: Snippet<[KbdRenderState]> | undefined
}
