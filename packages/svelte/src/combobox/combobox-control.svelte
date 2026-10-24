<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { comboboxHost } from "./context"
import type { ComboboxControlProps } from "./types"

const { child, children, ...rest }: ComboboxControlProps = $props()
const host = comboboxHost.get()
// After every change the constraint input mirrors the selection; a user change dispatches.
$effect(() => {
  const values = host.keys()
  untrack(() => {
    if (host.freeText) return
    host.formInput.sync({ values }, { dispatch: host.pending.current })
    host.pending.current = false
  })
})
$effect(() =>
  untrack(() =>
    host.freeText
      ? undefined
      : host.formInput.track({
          onReset: host.reset,
          current: () => ({ values: host.keys() }),
          onNativeInput: (input) => host.autofill(input.value),
        }),
  ),
)
const constraint = (node: HTMLInputElement) => {
  host.setConstraint(node)
  return () => host.setConstraint(null)
}
const api = $derived(host.api())
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.control()), rest)))
</script>

{#snippet content()}{@render children?.()}<span {...attrs(normalizeProps(api.chipsSummaryNode()))}
    >{api.chipsSummary}</span
  >{#if !host.freeText}<!-- Inside the Control: the browser's validation message is anchored near it. --><input
      {...attrs(normalizeProps(api.hiddenInput()))}
      {@attach constraint}
    />{#each api.carriers() as c (String(c["value"]))}<input
        {...attrs(normalizeProps(c))}
      />{/each}{/if}{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: content }, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render content()}</div>
{/if}
