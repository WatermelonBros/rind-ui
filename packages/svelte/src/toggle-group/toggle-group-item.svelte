<script lang="ts">
import { untrack } from "svelte"
import ToggleRoot from "../toggle/toggle-root.svelte"
import type { ToggleRootProps } from "../toggle/types"
import { groupContext } from "./context"
import GroupItem from "./toggle-group-group-item.svelte"
import type { ToggleGroupGroupItemProps, ToggleGroupItemProps } from "./types"

// Inside `ToggleGroup.Root` an item of the group (`value` is its key); alone, a single
// toggle button with its own `pressed` state (no group wrapper, no roving).
let { pressed = $bindable(), ...props }: ToggleGroupItemProps & { pressed?: boolean | undefined } =
  $props()
const group = groupContext.maybe()
if (group && untrack(() => props.value) === undefined)
  throw new Error("ToggleGroup.Item needs a `value` inside ToggleGroup.Root")
</script>

{#if group}
  <GroupItem {...props as ToggleGroupGroupItemProps} />
{:else}
  <ToggleRoot bind:pressed {...props as ToggleRootProps} />
{/if}
