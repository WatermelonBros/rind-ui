// The Drawer namespace: a module namespace (not an object), so bundlers drop the parts a
// consumer never references. Trigger, Portal, Title, Description and CloseTrigger are the
// Dialog's own.
export { default as CloseTrigger } from "../dialog/dialog-close-trigger.svelte"
export { default as Description } from "../dialog/dialog-description.svelte"
export { default as Portal } from "../dialog/dialog-portal.svelte"
export { default as Title } from "../dialog/dialog-title.svelte"
export { default as Trigger } from "../dialog/dialog-trigger.svelte"
export { default as Backdrop } from "./drawer-backdrop.svelte"
export { default as Content } from "./drawer-content.svelte"
export { default as Handle } from "./drawer-handle.svelte"
export { default as Indent } from "./drawer-indent.svelte"
export { default as IndentBackground } from "./drawer-indent-background.svelte"
export { default as Positioner } from "./drawer-positioner.svelte"
export { default as Root } from "./drawer-root.svelte"
