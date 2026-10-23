<script lang="ts">
import { Button, Fieldset, Toggle } from "../../src/index"

const { which = "button" }: { which?: string } = $props()
</script>

{#if which === "button"}
  <Fieldset.Root disabled><Button>Go</Button></Fieldset.Root>
{:else if which === "toggle"}
  <Fieldset.Root disabled><Toggle.Root>Go</Toggle.Root></Fieldset.Root>
{:else if which === "native"}
  <fieldset disabled><Button>Go</Button></fieldset>
{:else}
  <Button disabled>Go</Button>
{/if}
