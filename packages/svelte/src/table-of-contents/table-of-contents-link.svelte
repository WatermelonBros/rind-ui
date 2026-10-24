<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { tocContext, tocItem } from "./context"
import type { TableOfContentsLinkProps } from "./types"

const { child, children, ...rest }: TableOfContentsLinkProps = $props()
const ctx = tocContext.get()
const item = tocItem.maybe()
if (!item) throw new Error("TableOfContents.Link must be inside TableOfContents.Item")
const env = useEnvironment()
// The link's own focus, tracked from mount so the focusing key is already known.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(
        normalizeProps(ctx.api().link(item(), { focused, modality: modality.current })),
        {
          onfocus: (e: FocusEvent) => {
            if (e.target === e.currentTarget) focused = true
          },
          onblur: (e: FocusEvent) => {
            if (e.target === e.currentTarget) focused = false
          },
          onclick: (e: MouseEvent) => {
            // New tab, new window, download: the browser's, not a jump on this page.
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            ctx.navigate(item().id)
          },
        },
      ),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <a {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{item().label}{/if}</a>
{/if}
