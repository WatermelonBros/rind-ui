<script lang="ts">
import { type Announcer, platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Field, RindProvider, TextField } from "../../src/index"

type Config = {
  textarea?: boolean
  autosize?: boolean
  maxLength?: number
  softMax?: number
  readOnly?: boolean
  disabled?: boolean
  focusableWhenDisabled?: boolean
  controlled?: boolean
  inField?: boolean
}
const { cfg, announcer }: { cfg: Config; announcer: Announcer } = $props()
let value = $state("abc")
const root = $derived({
  ...(cfg.readOnly ? { readonly: true } : {}),
  ...(cfg.disabled ? { disabled: true } : {}),
  ...(cfg.focusableWhenDisabled ? { focusableWhenDisabled: true } : {}),
})
</script>

{#snippet body()}
  <TextField.Label>Name</TextField.Label>
  {#if cfg.textarea}
    <TextField.Textarea autosize={cfg.autosize === true} maxlength={cfg.maxLength} />
  {:else}
    <TextField.Input maxlength={cfg.maxLength} />
  {/if}
  <TextField.ClearTrigger />
  <TextField.CharacterCount max={cfg.softMax} />
  <TextField.Description>Hint</TextField.Description>
  <TextField.ErrorMessage />
  <button type="reset">Reset</button>
{/snippet}

<RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }} {announcer}>
  <form onsubmit={(e) => e.preventDefault()}>
    {#if cfg.inField}
      <Field.Root validationMode="change">
        <Field.Label>Name</Field.Label>
        <TextField.Root defaultValue="abc">
          <TextField.Input />
          <TextField.ClearTrigger />
          <button type="reset">Reset</button>
        </TextField.Root>
        <Field.ErrorMessage />
      </Field.Root>
    {:else if cfg.controlled}
      <TextField.Root {...root} bind:value>{@render body()}</TextField.Root>
    {:else}
      <TextField.Root {...root} defaultValue="abc">{@render body()}</TextField.Root>
    {/if}
  </form>
</RindProvider>
