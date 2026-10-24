<script lang="ts">
import { type SectionNode, toKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { listboxHost, listboxSection } from "./context"
import type { ListboxSectionProps } from "./types"

const { section, label, child, children, ...rest }: ListboxSectionProps = $props()
const host = listboxHost.get()
listboxSection.set(untrack(() => ({ key: section.key, label: section.label })))
const node: SectionNode = $derived({
  type: "section",
  key: toKey(section.key),
  label: section.label,
})
// A section the host does not list (all its items filtered out) is hidden, still mounted.
const listed = $derived(
  !host.listed ||
    host
      .collection()
      .sections()
      .some((x) => x.key === node.key),
)
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.parts().section(node)), rest)))
</script>

{#if !listed}
  <div hidden>{@render children?.()}</div>
{:else if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}><span {...attrs(normalizeProps(host.parts().sectionLabel(node)))}
      >{#if label}{@render label()}{:else}{section.label}{/if}</span
    >{@render children?.()}</div>
{/if}
