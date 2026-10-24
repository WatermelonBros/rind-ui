import type {
  FieldMessages,
  FileRejection,
  MessageOverrides,
  PromptAttachment,
  PromptAttachmentsReason,
  PromptInputMessages,
  PromptInputState,
  PromptInputStatus,
  PromptMessage,
  PromptSubmitDetails,
  PromptSubmitKey,
  PromptValueReason,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLFormAttributes,
  HTMLTextareaAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

type Part<A> = Omit<A, "children"> & {
  /** Substitutes the rendered element. */
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}

export type PromptInputRootProps = Omit<
  Part<HTMLFormAttributes>,
  "onsubmit" | "defaultValue" | "value"
> & {
  /** The draft (controlled, `bind:value`). The machine's own writes are then proposals. */
  value?: string | undefined
  /** The initial draft (uncontrolled: the Textarea owns its value, writes are undoable). */
  readonly defaultValue?: string | undefined
  /** Every draft change: typing, the clear on send, a restore after a failure, a recall. */
  readonly onValueChange?:
    | ((value: string, details: { readonly reason: PromptValueReason }) => void)
    | undefined
  /** The attachments (controlled, `bind:attachments`). */
  attachments?: readonly PromptAttachment[] | undefined
  /** The initial attachments (uncontrolled). Default none. */
  readonly defaultAttachments?: readonly PromptAttachment[] | undefined
  /** Every attachments change: added files, removals, the clear on send, a restore. */
  readonly onAttachmentsChange?:
    | ((
        attachments: readonly PromptAttachment[],
        details: { readonly reason: PromptAttachmentsReason },
      ) => void)
    | undefined
  /**
   * Sends the prompt: called once per send with the draft and attachments as they were; both
   * clear at once. Return a promise to stay `submitting` until it settles; a rejection
   * restores the prompt into an empty draft. A synchronous throw fails the send and is
   * rethrown to whatever submitted.
   */
  readonly onSubmit?:
    | ((message: PromptMessage, details: PromptSubmitDetails) => unknown)
    | undefined
  /**
   * Your request's progress: `submitting` and `streaming` turn Submit into Stop, `idle` ends
   * it, `error` fails the send.
   */
  readonly status?: PromptInputStatus | undefined
  /** Submit was pressed while a reply is on its way. */
  readonly onStop?: (() => void) | undefined
  /** Files refused by `accept`, `maxFiles` or `maxFileSize`, with the reason of each. */
  readonly onReject?: ((rejections: readonly FileRejection[]) => void) | undefined
  /**
   * What sends from the Textarea: `"enter"` (Shift+Enter is a newline), `"mod+enter"`, or
   * `"none"` (only Submit). Mod+Enter always sends; with a coarse primary pointer (phones,
   * tablets) Enter is a newline. Default `"enter"`.
   */
  readonly submitKey?: PromptSubmitKey | undefined
  /** Past prompts, newest last: ArrowUp in an empty draft recalls them. */
  readonly history?: readonly string[] | undefined
  /** Accepted files, as `<input accept>`: MIME types, `type/*` and `.ext`. */
  readonly accept?: string | undefined
  /** The file chooser picks several files. Default `true`. */
  readonly multiple?: boolean | undefined
  /** The most attachments at once; more are refused. */
  readonly maxFiles?: number | undefined
  /** The largest file, in bytes; larger ones are refused. */
  readonly maxFileSize?: number | undefined
  /** The Textarea's form name. Default `"message"`. */
  readonly name?: string | undefined
  /** The attached files' form name. Default `"files"`. */
  readonly filesName?: string | undefined
  /** Disables every part: typing, sending, files. */
  readonly disabled?: boolean | undefined
  /** No typing and no files; the draft can still be sent. */
  readonly readOnly?: boolean | undefined
  /** The Field is invalid (also while over a CharacterCount's max). */
  readonly invalid?: boolean | undefined
  /** The Field's error messages (PromptInput.ErrorMessage shows them). */
  readonly errors?: readonly string[] | undefined
  /** Replaces any string that reaches assistive technology. */
  readonly messages?: Partial<PromptInputMessages> | undefined
  /** Replaces the Field's own strings. */
  readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
}

export type PromptInputTextareaProps = Omit<
  Part<HTMLTextareaAttributes>,
  "value" | "defaultValue" | "children"
> & {
  /** Grows with the content (`field-sizing: content`, a measured fallback). Default `true`. */
  readonly autosize?: boolean | undefined
}
export type PromptInputButtonProps = Part<HTMLButtonAttributes>
export type PromptInputSpanProps = Part<HTMLAttributes<HTMLSpanElement>>
export type PromptInputAttachmentsProps = Omit<Part<HTMLAttributes<HTMLDivElement>>, "children"> & {
  /** Renders one attachment; default: its name and its remove button. */
  readonly children?: Snippet<[PromptAttachment]> | undefined
}
export type PromptInputCharacterCountProps = PromptInputSpanProps & {
  /** A soft limit: over it, nothing is sent and the input is invalid; never a truncation. */
  readonly max?: number | undefined
  /** Counts the draft (a tokenizer for a token limit). Default: characters, a line break once. */
  readonly count?: ((value: string) => number) | undefined
}

/** What `usePromptInput()` returns: the state and the actions a suggestion or a menu uses. */
export interface PromptInputControl {
  /** The machine state. */
  readonly state: PromptInputState
  /** The draft. */
  readonly value: string
  /** The attachments. */
  readonly attachments: readonly PromptAttachment[]
  /** Sends the draft, through the same checks as Enter. */
  submit(): void
  /** Stops the reply (as Submit does while busy). */
  stop(): void
  /** Replaces the draft (reason `api`); ignored while an IME composition is open. */
  setValue(value: string): void
  /** Inserts text at the caret (or over the selection); ignored while composing. */
  insertText(text: string): void
  /** Focuses the Textarea. */
  focus(): void
  /** Opens the file chooser. */
  openFilePicker(): void
  /** Adds files, through the same checks as a drop. */
  addFiles(files: readonly File[]): void
}
