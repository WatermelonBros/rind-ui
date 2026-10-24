<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { navLevel, useLevelState } from "./context.svelte"
import type { NavigationMenuRootProps } from "./types"

// The `navigation` landmark and its root level.
let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  orientation,
  openOnHover,
  disabled,
  openDelay,
  closeDelay,
  skipDelay,
  patientClick,
  closedContent = "hidden",
  messages,
  id,
  child,
  children,
  ...rest
}: NavigationMenuRootProps = $props()
const uid = $props.id()
const ctx = useLevelState(
  () => ({
    value,
    defaultValue,
    onValueChange: (v, d) => {
      onValueChange?.(v, d)
      if (value !== undefined) value = v as string | null
    },
    orientation,
    id: id ?? undefined,
    uid,
    openOnHover,
    disabled,
    openDelay,
    closeDelay,
    skipDelay,
    patientClick,
    closedContent,
    messages,
    defaultOrientation: "horizontal",
  }),
  null,
)
navLevel.set(ctx)
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(ctx.api().root({ labelledBy: rest["aria-labelledby"] ?? undefined })),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <nav {...attrs(merged)}>{@render children?.()}</nav>
{/if}
