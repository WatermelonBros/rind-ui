<script lang="ts">
import { timelineConnect, timelineMessages } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { SvelteSet } from "svelte/reactivity"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { timelineContext } from "./context"
import type { TimelineRenderState, TimelineRootProps } from "./types"

const {
  current,
  orientation = "vertical",
  align = "start",
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: TimelineRootProps = $props()
const uid = $props.id()
const instance = $derived(id ?? uid)
const locale = useLocale(() => ownLocale)
const messages = useMessages("timeline", timelineMessages, () => ownMessages)
const indexes = new SvelteSet<number>()
const api = $derived(
  timelineConnect({
    instance,
    orientation,
    align,
    current,
    count: indexes.size === 0 ? 0 : Math.max(...indexes) + 1,
    messages: messages(),
  }),
)
const timelineState: TimelineRenderState = $derived({ orientation, align })
timelineContext.set({
  api: () => api,
  state: () => timelineState,
  register: (index) => {
    indexes.add(index)
    return () => indexes.delete(index)
  },
  locale: () => locale.current.locale,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: timelineState })}
{:else}
  <ol {...attrs(merged)}>{@render children?.(timelineState)}</ol>
{/if}
