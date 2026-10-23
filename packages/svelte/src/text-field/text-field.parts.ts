// The TextField namespace: a module namespace, so bundlers drop the parts never referenced.
// biome-ignore assist/source/organizeImports: the order of the parts is the order of their docs
export { default as Root } from "./text-field-root.svelte"
export { default as Label } from "../field/host-label.svelte"
export { default as Description } from "../field/host-description.svelte"
export { default as ErrorMessage } from "../field/host-error-message.svelte"
export { default as Input } from "./text-field-input.svelte"
export { default as Textarea } from "./text-field-textarea.svelte"
export { default as ClearTrigger } from "./text-field-clear-trigger.svelte"
export { default as CharacterCount } from "./text-field-character-count.svelte"
export { default as VisibilityTrigger } from "./text-field-visibility-trigger.svelte"
export { default as VisibilityIndicator } from "./text-field-visibility-indicator.svelte"
