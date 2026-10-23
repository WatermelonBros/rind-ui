<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RadioGroup, RindProvider, ToggleGroup, Toolbar } from "../../src/index"

const {
  name,
  root = {},
  provider = true,
}: { name: string; root?: Record<string, unknown>; provider?: boolean } = $props()
const plain = ["Undo", "Bold", "Link"]
</script>

{#snippet field(label: string)}
  <Toolbar.Item id={label}>{#snippet child({ props })}<input {...props} aria-label={label} defaultValue="hi" />{/snippet}</Toolbar.Item>
{/snippet}

{#snippet bar()}
  {#if name === "group"}
    <Toolbar.Root aria-label="Formatting" disabled><Toolbar.Group aria-label="History"><Toolbar.Button id="Undo">Undo</Toolbar.Button><Toolbar.Button id="Redo">Redo</Toolbar.Button></Toolbar.Group><Toolbar.Separator /><Toolbar.Link href="#help">Help</Toolbar.Link></Toolbar.Root>
  {:else}
    <Toolbar.Root aria-label="Formatting" {...root}>
      {#if name === "first disabled, not focusable"}<Toolbar.Button id="Undo" disabled>Undo</Toolbar.Button><Toolbar.Button id="Bold">Bold</Toolbar.Button><Toolbar.Button id="Link">Link</Toolbar.Button>{:else if name === "text field in the middle"}<Toolbar.Button id="Undo">Undo</Toolbar.Button>{@render field("Size")}<Toolbar.Button id="Bold">Bold</Toolbar.Button>{:else if name === "hosted toggle group and radio group"}<Toolbar.Button id="Undo">Undo</Toolbar.Button><ToggleGroup.Root id="style" aria-label="Style" selectionMode="multiple"><ToggleGroup.Item value="b">Bold</ToggleGroup.Item><ToggleGroup.Item value="i">Italic</ToggleGroup.Item></ToggleGroup.Root><RadioGroup.Root id="align" aria-label="Align" defaultValue="l">{#each ["l", "r"] as v (v)}<RadioGroup.Item value={v}><RadioGroup.ItemControl aria-label={v === "l" ? "Left" : "Right"} /></RadioGroup.Item>{/each}</RadioGroup.Root>{:else}{#each plain as l (l)}<Toolbar.Button id={l}>{l}</Toolbar.Button>{/each}{/if}
    </Toolbar.Root>
  {/if}
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }} dir={currentRun()?.direction ?? "ltr"}>
    <button type="button">Before</button>
    {@render bar()}
    <button type="button">After</button>
  </RindProvider>
{:else}
  {@render bar()}
{/if}
