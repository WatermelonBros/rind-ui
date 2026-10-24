// The Accordion namespace: a module namespace, so bundlers drop the parts never referenced.
// Trigger, Content and Indicator are the Collapsible's, inside each item's Collapsible context.
export { default as Content } from "../collapsible/collapsible-content.svelte"
export { default as Indicator } from "../collapsible/collapsible-indicator.svelte"
export { default as Trigger } from "../collapsible/collapsible-trigger.svelte"
export { default as Header } from "./accordion-header.svelte"
export { default as Item } from "./accordion-item.svelte"
export { default as Root } from "./accordion-root.svelte"
