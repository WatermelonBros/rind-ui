<script lang="ts">
import type { Snippet } from "svelte"
import { comboboxChip } from "./context"

// Provides one chip's key to the parts inside it.
const { chip, children }: { chip: string; children: Snippet } = $props()
// svelte-ignore state_referenced_locally
comboboxChip.set(chip)
</script>

{@render children()}
