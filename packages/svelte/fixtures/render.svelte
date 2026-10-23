<script lang="ts">
import type { Component } from "svelte"

// One component with props and, optionally, text content: the generic parity fixture.
const {
  is: Is,
  text,
  ...props
}: { is: Component<Record<string, unknown>>; text?: string; [key: string]: unknown } = $props()
</script>

{#if text === undefined}
  <Is {...props} />
{:else}
  <Is {...props}>{text}</Is>
{/if}
