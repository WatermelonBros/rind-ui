// The Mentions namespace: a module namespace (not an object), so bundlers drop the parts a
// consumer never references. The list parts are the listbox parts and the Combobox's popup
// parts, bound by the Root.
export { default as Popup } from "../combobox/combobox-popup.svelte"
export { default as Positioner } from "../combobox/combobox-positioner.svelte"
export { default as Empty } from "../listbox/listbox-empty.svelte"
export { default as Item } from "../listbox/listbox-item.svelte"
export { default as ItemText } from "../listbox/listbox-item-text.svelte"
export { default as Items } from "../listbox/listbox-items.svelte"
export { default as List } from "../listbox/listbox-list.svelte"
export { default as Group } from "../listbox/listbox-section.svelte"
export { default as Description } from "./mentions-description.svelte"
export { default as Highlighter } from "./mentions-highlighter.svelte"
export { default as Loading } from "./mentions-loading.svelte"
export { default as Root } from "./mentions-root.svelte"
export { default as Textarea } from "./mentions-textarea.svelte"
