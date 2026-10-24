// The Menubar namespace: a module namespace (not an object), so bundlers drop the parts a
// consumer never references.
export { default as Menu } from "./menubar-menu.svelte"
export { default as Root } from "./menubar-root.svelte"
export { default as Trigger } from "./menubar-trigger.svelte"
