<script lang="ts">
import type { HTMLInputAttributes } from "svelte/elements"
import type { TextFieldInputProps } from "./types"
import { useControl } from "./use-control.svelte"

const { child, ...rest }: TextFieldInputProps = $props()
const uid = $props.id()
const control = useControl("input", uid, () => rest as Readonly<Record<string, unknown>>)
</script>

{#if child}
  {@render child({ props: control.props, state: { composing: control.composing } })}
{:else}
  <!-- The control's props are the input's attributes and handlers. -->
  <input {...control.props as HTMLInputAttributes} />
{/if}
