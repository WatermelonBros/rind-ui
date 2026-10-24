<script lang="ts">
import type { TourAction } from "@rind-ui/core"
import type { Snippet } from "svelte"
import { tourApi, tourHost } from "./context.svelte"
import type { TourActionsProps } from "./types"

// Renders its children with the shown step's actions.
const { children }: TourActionsProps = $props()
const ctx = tourHost.get()
// Sound: the steps are TourStepDef, whose actions carry text or snippet labels.
const actions = $derived(tourApi(ctx).api.actions as readonly TourAction<string | Snippet>[])
</script>

{@render children(actions)}
