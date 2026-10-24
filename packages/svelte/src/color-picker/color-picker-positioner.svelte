<script lang="ts">
import type { Snippet } from "svelte"
import Part from "../popover/popover-positioner.svelte"
import { colorPicker } from "./context"

// In place when inline; else the Popover's own part.
const { children, ...props }: { children?: Snippet } & Record<string, unknown> = $props()
const ctx = colorPicker.get()
</script>

{#if ctx.inline}{@render children?.()}{:else}<Part {...props as Record<string, unknown>}>{@render children?.()}</Part>{/if}
