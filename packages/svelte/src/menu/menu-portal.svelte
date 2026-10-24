<script lang="ts">
import Portal from "../portal/portal.svelte"
import type { PortalProps } from "../portal/types"
import { menuLevel } from "./context.svelte"

// The Portal with the trigger as its logical parent: the host carries its theme, dir and lang.
const props: PortalProps = $props()
const ctx = menuLevel.get()
const logicalParent = () => ctx.shared.trigger
</script>

<Portal {logicalParent} {...props} />
