<script lang="ts">
import Portal from "../portal/portal.svelte"
import type { PortalProps } from "../portal/types"
import { isOpen, tooltipHost } from "./context.svelte"

// The Portal with the trigger as its logical parent: the host carries its theme, dir and lang.
const props: PortalProps = $props()
const ctx = tooltipHost.get()
const logicalParent = () => ctx.shared.trigger
</script>

<!-- Closed tooltips cost nothing: the host follows the trigger's theme only while open. -->
<Portal {logicalParent} observe={isOpen(ctx)} {...props} />
