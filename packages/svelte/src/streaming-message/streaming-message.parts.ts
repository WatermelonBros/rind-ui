// The StreamingMessage namespace: a module namespace (not an object), so bundlers drop the parts
// a consumer never references.
export { default as Caret } from "./streaming-message-caret.svelte"
export { default as Content } from "./streaming-message-content.svelte"
export { default as Root } from "./streaming-message-root.svelte"
