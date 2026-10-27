<script lang="ts">
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { messageActionsContext } from "./context"
import type { MessageActionsPartProps } from "./types"

/** "2 / 3", `aria-hidden` (a move announces "Version 2 of 3"); its content replaces it. */
const { children, ...rest }: MessageActionsPartProps = $props()
const ctx = messageActionsContext.get()
</script>

<span {...attrs(mergeProps(normalizeProps(ctx.api().versionStatus()), rest))}>{#if children}{@render children()}{:else}{ctx.api().versionText}{/if}</span>
