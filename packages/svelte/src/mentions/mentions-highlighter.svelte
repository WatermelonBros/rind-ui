<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { mentionsHost } from "./context"
import type { MentionsHighlighterProps } from "./types"

/** The text mirrored under the textarea, the mentions painted (hidden from assistive technology). */
const { mention, ...rest }: MentionsHighlighterProps = $props()
const host = mentionsHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().highlighter()), rest)))
const capture = (node: HTMLElement) => {
  host.highlighter.current = node
  return () => {
    if (host.highlighter.current === node) host.highlighter.current = null
  }
}
</script>

<div {...attrs(merged)} {@attach capture}>{#each host.api().segments as s, i (i)}{#if s.kind === "text"}<span>{s.text}</span>{:else}<mark {...attrs(normalizeProps(host.api().mention(s.mention)))}>{#if mention}{@render mention({ mention: s.mention, text: s.text })}{:else}{s.text}{/if}</mark>{/if}{/each}</div>
