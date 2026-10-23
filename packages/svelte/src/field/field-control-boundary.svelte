<script lang="ts">
import type { Snippet } from "svelte"
import { fieldControl, fieldEmbedded } from "./context.svelte"

// Marks a subtree whose form controls are a component's own (a Color Picker's inputs): they
// do not register with the enclosing Field, do not become a Field and get no Field wiring.
const { children }: { children?: Snippet } = $props()
fieldControl.set(null)
fieldEmbedded.set(true)
</script>

{@render children?.()}
