<script lang="ts">
import Portal from "../portal/portal.svelte"
import type { PortalProps } from "../portal/types"
import { useEnvironment } from "../provider"
import { dialogHost } from "./context.svelte"

const props: PortalProps = $props()
const ctx = dialogHost.get()
const env = useEnvironment()
// The opener once open; before that (and when opened programmatically) the first trigger, so
// the host carries the trigger's theme, dir and lang from the first open on.
const logicalParent = () => {
  const opener = ctx.view().context.opener
  return (
    (opener ? env.dom.getById(opener) : null) ??
    env.dom
      .getRootNode()
      .querySelector?.(
        `[data-scope="${ctx.scope}"][data-part="trigger"][data-instance="${ctx.root()}"]`,
      ) ??
    null
  )
}
</script>

<Portal {logicalParent} {...props} />
