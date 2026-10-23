<script lang="ts">
import { ScrollArea } from "../../src/index"

const { root = {}, both = false }: { root?: Record<string, unknown>; both?: boolean } = $props()
const NOTES = Array.from({ length: 40 }, (_, i) => `Note ${i + 1}`)
</script>

<div id="app">
  <ScrollArea.Root {...root} style="width: 200px; height: 200px">
    <ScrollArea.Viewport aria-label="Notes" style="width: 100%; height: 100%">
      <ScrollArea.Content>{#each NOTES as text (text)}<p style="margin: 0; height: 20px">{text}</p>{/each}</ScrollArea.Content>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar style="width: 10px; display: flex; flex-direction: column">
      <ScrollArea.Thumb style="height: var(--rind-scroll-area-thumb-size)" />
    </ScrollArea.Scrollbar>
    {#if both}<ScrollArea.Scrollbar orientation="horizontal"><ScrollArea.Thumb /></ScrollArea.Scrollbar><ScrollArea.Corner />{/if}
  </ScrollArea.Root>
</div>
