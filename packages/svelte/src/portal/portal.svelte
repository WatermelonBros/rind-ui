<script lang="ts">
// Renders its content into a host `div[data-rind-portal]` outside the tree: mounted there with
// this component's contexts. Nothing on the server and nothing during hydration (no mismatch:
// radix#1386); mounts after. Follows a changing `container` (radix#3599).
import { resolvePortalTarget } from "@rind-ui/core"
import { getAllContexts, mount, unmount, untrack } from "svelte"
import { compositeHost } from "../composite-host.svelte"
import { separatorHost } from "../separator/context"
import PortalHost from "./portal-host.svelte"
import type { PortalProps } from "./types"

const { container, logicalParent, observe = true, child, children, ...rest }: PortalProps = $props()
// A component in a popup is not hosted by the toolbar its trigger sits in (nor are its
// separators drawn in the toolbar's context).
compositeHost.set(null)
separatorHost.set(() => null)
const contexts = getAllContexts()
const parent = () => logicalParent?.() ?? null
// The element itself: the host remounts only when it changes, not when the logical parent's
// inputs do (a dialog's opener set on open; a remounted host is a node added after the layer
// opened, which dismiss treats as not outside).
const target = $derived(resolvePortalTarget(parent(), container))
$effect(() => {
  const into = target
  const host = untrack(() =>
    mount(PortalHost, {
      // A shadow root is a valid parent for the host.
      target: into as Element,
      context: contexts,
      props: {
        get rest() {
          return rest
        },
        get child() {
          return child
        },
        get children() {
          return children
        },
        get observe() {
          return observe
        },
        parent,
      },
    }),
  )
  return () => {
    void unmount(host)
  }
})
</script>
