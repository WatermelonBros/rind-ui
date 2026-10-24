<script lang="ts">
import { Field, TextField } from "../../src/index"

const { variant, root = {} }: { variant: string; root?: Record<string, unknown> } = $props()
</script>

{#if variant === "parts"}
  <TextField.Root {...root}>
    <TextField.Label>Name</TextField.Label>
    <TextField.Input />
    <TextField.Description>Hint</TextField.Description>
    <TextField.ErrorMessage />
  </TextField.Root>
{:else if variant === "password"}
  <TextField.Root type="password">
    <TextField.Label>Pw</TextField.Label>
    <TextField.Input />
    <TextField.VisibilityTrigger>Show<TextField.VisibilityIndicator /></TextField.VisibilityTrigger>
  </TextField.Root>
{:else if variant === "textarea"}
  <TextField.Root defaultValue="abc">
    <TextField.Label>Bio</TextField.Label>
    <TextField.Textarea />
    <TextField.CharacterCount max={10} />
  </TextField.Root>
{:else}
  <Field.Root invalid>
    <Field.Label>Name</Field.Label>
    <TextField.Root><TextField.Input /></TextField.Root>
    <Field.Description>D</Field.Description>
    <Field.ErrorMessage>Bad</Field.ErrorMessage>
  </Field.Root>
{/if}
