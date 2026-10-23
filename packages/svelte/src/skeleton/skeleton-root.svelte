<script lang="ts">
import {
  announcerCapability,
  skeletonConnect,
  skeletonMachine,
  skeletonMessages,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { skeletonContext } from "./context"
import type { SkeletonRootProps } from "./types"

const {
  loading = true,
  announceOnLoad,
  animate = true,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: SkeletonRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("skeleton", skeletonMessages, () => ownMessages)
const locale = useLocale(() => undefined)
const env = useEnvironment(announcerCapability)
const machine = useMachine(
  skeletonMachine,
  () => ({
    loading,
    announceOnLoad,
    messages: messages(),
    id: instance,
    lang: locale.current.locale,
  }),
  env,
)
const isLoading = $derived(machine.view.state === "loading")
const connect = $derived(skeletonConnect({ instance, loading: isLoading, animate }))
skeletonContext.set({
  connect: () => connect,
  messages: () => messages(),
  loading: () => isLoading,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(connect.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: { loading: isLoading } })}
{:else}
  <div {...attrs(merged)}>{@render children?.({ loading: isLoading })}</div>
{/if}
