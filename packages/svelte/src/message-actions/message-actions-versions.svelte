<script lang="ts">
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { messageActionsContext } from "./context"
import type { MessageActionsPartProps } from "./types"

/** A group ("Versions"), rendered from two versions. */
const { children, ...rest }: MessageActionsPartProps = $props()
const ctx = messageActionsContext.get()
</script>

{#if ctx.api().hasVersions}
  <div {...attrs(mergeProps(normalizeProps(ctx.api().versions()), rest))}>{@render children?.()}</div>
{/if}
