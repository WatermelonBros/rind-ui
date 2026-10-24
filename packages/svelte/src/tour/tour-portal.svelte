<script lang="ts">
import { tourIds } from "@rind-ui/core"
import Portal from "../portal/portal.svelte"
import type { PortalProps } from "../portal/types"
import { useEnvironment } from "../provider"
import { tourHost } from "./context.svelte"

// The host carries the trigger's theme, dir and lang.
const props: PortalProps = $props()
const ctx = tourHost.get()
const env = useEnvironment()
const logicalParent = () => env.dom.getById(tourIds(ctx.tour.root).trigger)
</script>

<Portal {logicalParent} {...props} />
