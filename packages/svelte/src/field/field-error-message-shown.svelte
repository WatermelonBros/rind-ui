<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { fieldParts } from "./context.svelte"
import type { FieldErrorMessageProps } from "./types"

const {
  own,
  setEl,
  match: _m,
  child,
  children,
  ...rest
}: FieldErrorMessageProps & { own: string; setEl: (el: Element | null) => void } = $props()
const ctx = fieldParts.get()
useRegisterPart(ctx.registry, "error-message", () => own)
const el = elementRef("p")
$effect(() => setEl(el.current))
const messages = $derived(ctx.api().messages)
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().errorMessage(own)), ...el.props }, rest)),
)
const current = $derived({
  valid: false,
  invalid: ctx.api().display === "invalid",
  validating: false,
})
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <p {...attrs(merged)}
    >{#if children}{@render children(messages)}{:else if messages.length > 1}<!-- As @rind-ui/react renders it (a list inside the <p>: see the change's design, Risks). --><svelte:element this={"ul"}>{#each messages as m (m)}<svelte:element this={"li"}>{m}</svelte:element>{/each}</svelte:element>{:else}{messages[0]}{/if}</p
  >
{/if}
