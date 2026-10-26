// The Citation namespace: a module namespace, so bundlers drop the parts never referenced.
// Portal, Content and Positioner are Hover Card's own (the card: non-modal, reachable with Tab;
// portalled, as a citation sits inside a paragraph and the card is block content).
export { default as Content } from "../hover-card/hover-card-content.svelte"
export { default as Portal } from "../hover-card/hover-card-portal.svelte"
export { default as Positioner } from "../hover-card/hover-card-positioner.svelte"
export { default as CitedText } from "./citation-cited-text.svelte"
export { default as Root } from "./citation-root.svelte"
export { default as Source } from "./citation-source.svelte"
export { default as SourceLink } from "./citation-source-link.svelte"
export { default as SourceSnippet } from "./citation-source-snippet.svelte"
export { default as SourceTitle } from "./citation-source-title.svelte"
export { default as SourceUrl } from "./citation-source-url.svelte"
export { default as Trigger } from "./citation-trigger.svelte"
