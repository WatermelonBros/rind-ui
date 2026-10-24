<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { listboxHost } from "./context"
import type { ListboxPartProps } from "./types"

// A decorative separator takes no name.
const {
  "aria-label": _l,
  "aria-labelledby": _b,
  child,
  children: _c,
  ...rest
}: ListboxPartProps = $props()
const host = listboxHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.parts().separator()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}></div>
{/if}
