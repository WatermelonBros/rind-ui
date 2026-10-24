<script lang="ts">
import { popoverIds } from "@rind-ui/core"
import Portal from "../portal/portal.svelte"
import type { PortalProps } from "../portal/types"
import { useEnvironment } from "../provider"
import { popoverHost } from "./context.svelte"

// The Portal with the trigger as its logical parent: the host carries its theme, dir and lang.
const props: PortalProps = $props()
const ctx = popoverHost.get()
const env = useEnvironment()
const logicalParent = () => env.dom.getById(popoverIds(ctx.root(), ctx.scope()).trigger)
</script>

<Portal {logicalParent} {...props} />
