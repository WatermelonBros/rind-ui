<script lang="ts">
import { Button, Fieldset, Toggle } from "../../src/index"

const {
  root = {},
  legend = true,
  desc = true,
  error = true,
  variant = "tree",
  onPress,
}: {
  root?: Record<string, unknown>
  legend?: boolean
  desc?: boolean
  error?: boolean
  variant?: "tree" | "nested" | "div-legend" | "runtime"
  onPress?: () => void
} = $props()
</script>

{#if variant === "tree"}
  <Fieldset.Root {...root}>
    {#if legend}<Fieldset.Legend>Shipping<Button>Help</Button></Fieldset.Legend>{/if}
    {#if desc}<Fieldset.Description>Where it goes</Fieldset.Description>{/if}
    <Toggle.Root>Gift</Toggle.Root>
    <input aria-label="Street" />
    {#if error}<Fieldset.ErrorMessage>Required</Fieldset.ErrorMessage>{/if}
  </Fieldset.Root>
{:else if variant === "nested"}
  <Fieldset.Root disabled>
    <Fieldset.Root><Fieldset.Legend>Inner</Fieldset.Legend><Button>Go</Button></Fieldset.Root>
  </Fieldset.Root>
{:else if variant === "div-legend"}
  <Fieldset.Root>
    <Fieldset.Legend>
      {#snippet child({ props })}<div {...props}>Name</div>{/snippet}
    </Fieldset.Legend>
  </Fieldset.Root>
{:else}
  <Fieldset.Root {...root}><Button {onPress}>Go</Button></Fieldset.Root>
{/if}
