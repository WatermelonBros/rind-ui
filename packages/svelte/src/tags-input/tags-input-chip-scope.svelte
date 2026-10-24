<script lang="ts">
import type { Chip } from "@rind-ui/core"
import type { Snippet } from "svelte"
import { tagsInputChip } from "./context"

// Provides one chip to the parts inside it.
const { chip, children }: { chip: Chip; children: Snippet } = $props()
tagsInputChip.set(() => chip)
</script>

{@render children()}
