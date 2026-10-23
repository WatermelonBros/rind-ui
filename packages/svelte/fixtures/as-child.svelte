<script lang="ts">
import type { Component } from "svelte"

// A component rendered through its `child` snippet as `tag`, with text content.
const {
  is: Is,
  tag,
  text,
  attributes = {},
  ...props
}: {
  is: Component<Record<string, unknown>>
  tag: string
  text?: string
  attributes?: Record<string, unknown>
  [key: string]: unknown
} = $props()
const voids = new Set(["hr", "br", "img", "input"])
</script>

<Is {...props}>
  {#snippet child({ props: p }: { props: Record<string, unknown> })}
    {#if voids.has(tag)}
      <svelte:element this={tag} {...attributes} {...p} />
    {:else}
      <svelte:element this={tag} {...attributes} {...p}>{text}</svelte:element>
    {/if}
  {/snippet}
</Is>
