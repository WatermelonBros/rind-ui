import { FieldDescription, FieldErrorMessage, FieldLabel } from "../field/field"
import {
  PromptInputAttachment,
  PromptInputAttachmentName,
  PromptInputAttachmentRemove,
  PromptInputAttachments,
  PromptInputAttachTrigger,
  PromptInputCharacterCount,
  PromptInputRoot,
  PromptInputSubmit,
  PromptInputTextarea,
} from "./prompt-input"

export * from "./prompt-input"

/**
 * The Prompt Input's parts, for a standalone component's `imports` (its Label, Description and
 * ErrorMessage are the Field's).
 */
export const PromptInput = [
  PromptInputRoot,
  FieldLabel,
  FieldDescription,
  FieldErrorMessage,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputAttachTrigger,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputAttachmentName,
  PromptInputAttachmentRemove,
  PromptInputCharacterCount,
] as const
