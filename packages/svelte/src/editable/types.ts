import type {
  ActivationMode,
  ChangeDetails,
  EditableEvent,
  EditableMessages,
  EditableState,
  MessageOverrides,
  SubmitMode,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLInputAttributes,
  HTMLLabelAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    editable: EditableMessages
  }
}

/** What every part's snippets receive. */
export interface EditableRenderState {
  readonly state: EditableState
  readonly editing: boolean
  readonly value: string
  readonly draft: string
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<EditableRenderState>]> | undefined
  readonly children?: Snippet<[EditableRenderState]> | undefined
}

export type EditableRootProps = Part<Omit<HTMLAttributes<HTMLDivElement>, "defaultValue">> & {
  /** The committed value; `bind:value` controls it. */
  value?: string | undefined
  /** Uncontrolled committed value. Default "". */
  readonly defaultValue?: string | undefined
  /** A commit; `details.event.reason` says how. */
  readonly onValueChange?:
    | ((value: string, details: ChangeDetails<EditableEvent>) => void)
    | undefined
  /** The edit state; `bind:edit` controls it. */
  edit?: boolean | undefined
  /** Uncontrolled edit state. Default false. */
  readonly defaultEdit?: boolean | undefined
  /** Entering or leaving edit; `details.cancel()` keeps the user where they are. */
  readonly onEditChange?:
    | ((edit: boolean, details: ChangeDetails<EditableEvent>) => void)
    | undefined
  /** Each edit of the draft. */
  readonly onDraftChange?: ((draft: string) => void) | undefined
  /** How the Preview enters edit (Enter and Space always do, except `none`). Default "click". */
  readonly activationMode?: ActivationMode | undefined
  /** Whether an outside press submits (both, blur) or cancels (enter, none). Default "both". */
  readonly submitMode?: SubmitMode | undefined
  /** Select the text on entering edit. Default true. */
  readonly selectOnFocus?: boolean | undefined
  /** Shown when the value is empty. */
  readonly placeholder?: string | { readonly edit: string; readonly preview: string } | undefined
  /** The Input's maximum length. */
  readonly maxLength?: number | undefined
  /** No edit; not submitted. */
  readonly disabled?: boolean | undefined
  /** Shown and submitted; no edit. */
  readonly readonly?: boolean | undefined
  /** An empty value blocks submit. */
  readonly required?: boolean | undefined
  /** Marks the field invalid. */
  readonly invalid?: boolean | undefined
  /** The form field's name. */
  readonly name?: string | undefined
  /** The form id, when the Editable is outside it. */
  readonly form?: string | undefined
  readonly messages?: MessageOverrides<EditableMessages> | undefined
}
export type EditableLabelProps = Part<HTMLLabelAttributes>
export type EditableDivProps = Part<HTMLAttributes<HTMLDivElement>>
export type EditableButtonProps = Part<HTMLButtonAttributes>
export type EditableInputProps = Omit<HTMLInputAttributes, "children"> & {
  /** Renders another element (a textarea) with the Input's props. */
  readonly child?: Snippet<[ChildArgs<EditableRenderState>]> | undefined
}
