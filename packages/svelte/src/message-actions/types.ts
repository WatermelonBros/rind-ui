import type { MessageActionsMessages, MessageOverrides, RegenerateState } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ToggleGroupRootProps } from "../toggle-group/types"
import type { ToolbarItemProps, ToolbarRootProps } from "../toolbar/types"

declare module "../provider" {
  interface RindMessageScopes {
    "message-actions": MessageActionsMessages
  }
}

/** What the Root's children snippet receives. */
export interface MessageActionsRenderState {
  readonly active: boolean
  readonly editing: boolean
  readonly regenerate: RegenerateState
  readonly index: number
  readonly count: number
}

export type MessageActionsRootProps = Omit<ToolbarRootProps, "children" | "child"> & {
  /** Forces the row visible. */
  readonly active?: boolean | undefined
  /** Regenerate the message. */
  readonly onRegenerate?: (() => void | Promise<void>) | undefined
  /** Editing; `bind:editing` controls it. */
  editing?: boolean | undefined
  /** Uncontrolled editing. Default false. */
  readonly defaultEditing?: boolean | undefined
  /** Edit was toggled. */
  readonly onEditingChange?: ((editing: boolean) => void) | undefined
  /** How many versions the message has. Default 0. */
  readonly count?: number | undefined
  /** The version index (0-based); `bind:index` controls it. */
  index?: number | undefined
  /** Uncontrolled version index. Default 0. */
  readonly defaultIndex?: number | undefined
  /** A move between versions. */
  readonly onIndexChange?: ((index: number) => void) | undefined
  /** The version buttons wrap around. */
  readonly loop?: boolean | undefined
  readonly messages?: MessageOverrides<MessageActionsMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  /**
   * The message element whose hover, focus and touch show the row. Default: the Root's
   * parent element.
   */
  readonly host?: (() => Element | null) | undefined
  readonly children?: Snippet<[MessageActionsRenderState]> | undefined
}
export type MessageActionsButtonProps = Omit<HTMLButtonAttributes, "children"> & {
  readonly children?: Snippet | undefined
}
export type MessageActionsItemProps = ToolbarItemProps
export type MessageActionsCopyProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** What a press copies; a function is called at press time (the message's latest text). */
  readonly value: string | (() => string)
  /** The Trigger's content (an icon); the name stays `messages.copy`. */
  readonly children?: Snippet | undefined
}
export type MessageActionsFeedbackProps = Omit<ToggleGroupRootProps, "selectionMode">
export type MessageActionsFeedbackItemProps = Omit<HTMLButtonAttributes, "value" | "children"> & {
  /** Thumbs up or down. */
  readonly value: "up" | "down"
  readonly children?: Snippet | undefined
}
export type MessageActionsPartProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  readonly children?: Snippet | undefined
}
