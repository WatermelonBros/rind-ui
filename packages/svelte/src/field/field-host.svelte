<script lang="ts">
import { type Snippet, untrack } from "svelte"
import { useFieldBindingPeek, useIsInsideField } from "./context.svelte"
import FieldRoot from "./field-root.svelte"
import { fieldHost } from "./host-context"
import type { FieldRootProps } from "./types"

// The Root-as-Field helper (text-field design §3): a control's Root that is not inside a
// Field becomes one (the Field's machine and parts, under the control's scope); inside a
// Field it only joins it, and its own Label / Description / ErrorMessage render nothing.
const {
  scope,
  rootPart,
  children,
  ...fieldProps
}: Omit<FieldRootProps, "children"> & {
  scope: string
  rootPart?: string | undefined
  children?: Snippet
} = $props()
const inside = useIsInsideField()
const binding = useFieldBindingPeek()
// Read once: the host is fixed for the instance.
fieldHost.set(untrack(() => ({ scope, standalone: !inside })))
// The host's own Field props are ignored inside a Field: the enclosing Field decides.
const plain = $derived(
  Object.fromEntries(
    Object.entries(fieldProps).filter(
      ([k]) => k.startsWith("data-") || k.startsWith("aria-") || k === "class" || k === "style",
    ),
  ),
)
</script>

{#if !inside}
  <FieldRoot {...fieldProps} {scope} {rootPart}>{@render children?.()}</FieldRoot>
{:else}
  <div
    data-scope={scope}
    data-part={rootPart ?? "root"}
    data-instance={fieldProps.id ?? undefined}
    {...binding?.().data}
    id={fieldProps.id ?? undefined}
    {...plain}
  >
    {@render children?.()}
  </div>
{/if}
