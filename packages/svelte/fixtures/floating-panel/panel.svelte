<script lang="ts">
import { FloatingPanel, RindProvider } from "../../src/index"

const {
  root = {},
  full = true,
  onBound = undefined,
}: {
  root?: Record<string, unknown>
  full?: boolean
  onBound?: ((position: { x: number; y: number }) => void) | undefined
} = $props()
let bound = $state({ x: 0, y: 0 })
$effect(() => onBound?.(bound))
</script>

{#if onBound}
  <RindProvider><FloatingPanel.Root defaultOpen bind:position={bound}><FloatingPanel.Positioner><FloatingPanel.Content><FloatingPanel.Header><FloatingPanel.DragTrigger>⠿</FloatingPanel.DragTrigger><FloatingPanel.Title>Notes</FloatingPanel.Title></FloatingPanel.Header></FloatingPanel.Content></FloatingPanel.Positioner></FloatingPanel.Root></RindProvider>
{:else if full}
  <RindProvider>
    <FloatingPanel.Root defaultPosition={{ x: 40, y: 40 }} {...root}>
      <FloatingPanel.Trigger>Open notes</FloatingPanel.Trigger>
      <FloatingPanel.Positioner><FloatingPanel.Content><FloatingPanel.Header><FloatingPanel.DragTrigger>⠿</FloatingPanel.DragTrigger><FloatingPanel.Title>Notes</FloatingPanel.Title><FloatingPanel.Control><FloatingPanel.StageTrigger stage="minimized">_</FloatingPanel.StageTrigger><FloatingPanel.CloseTrigger>×</FloatingPanel.CloseTrigger></FloatingPanel.Control></FloatingPanel.Header><FloatingPanel.Body>Body</FloatingPanel.Body></FloatingPanel.Content></FloatingPanel.Positioner>
    </FloatingPanel.Root>
    <button type="button">Outside</button>
  </RindProvider>
{:else}
  <RindProvider><FloatingPanel.Root defaultOpen defaultPosition={{ x: 10, y: 20 }}><FloatingPanel.Positioner><FloatingPanel.Content><FloatingPanel.Header><FloatingPanel.DragTrigger>⠿</FloatingPanel.DragTrigger><FloatingPanel.Title>Notes</FloatingPanel.Title></FloatingPanel.Header><FloatingPanel.Body>Body</FloatingPanel.Body></FloatingPanel.Content></FloatingPanel.Positioner></FloatingPanel.Root></RindProvider>
{/if}
