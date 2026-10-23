<script lang="ts">
import { avatarGroupProps, checkAvatarGroupName } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import type { AvatarGroupProps } from "./types"

const { id, child, children, ...rest }: AvatarGroupProps = $props()
const uid = $props.id()
// A development check, once.
$effect(() => untrack(() => checkAvatarGroupName(rest as Readonly<Record<string, unknown>>)))
const merged = $derived(
  stripMarker(
    mergeProps(
      { ...normalizeProps(avatarGroupProps(id ?? uid)), ...(id === undefined ? {} : { id }) },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
