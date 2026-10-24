<script lang="ts">
import type { Snippet } from "svelte"
import { single, useApi, useDateField } from "./context"

// The single Root's parts for the picker parts, read under its Field (the binding's label).
const { children }: { children?: Snippet } = $props()
const ctx = useDateField("Root")
single.set({ ctx, api: useApi(ctx) })
</script>

{@render children?.()}
