// The PromptInput namespace: a module namespace (not an object), so bundlers drop the parts a
// consumer never references.
export { default as Description } from "../field/host-description.svelte"
export { default as ErrorMessage } from "../field/host-error-message.svelte"
export { default as Label } from "../field/host-label.svelte"
export { default as AttachTrigger } from "./prompt-input-attach-trigger.svelte"
export { default as Attachment } from "./prompt-input-attachment.svelte"
export { default as AttachmentName } from "./prompt-input-attachment-name.svelte"
export { default as AttachmentRemove } from "./prompt-input-attachment-remove.svelte"
export { default as Attachments } from "./prompt-input-attachments.svelte"
export { default as CharacterCount } from "./prompt-input-character-count.svelte"
export { default as Root } from "./prompt-input-root.svelte"
export { default as Submit } from "./prompt-input-submit.svelte"
export { default as Textarea } from "./prompt-input-textarea.svelte"
