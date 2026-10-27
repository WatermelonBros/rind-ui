<script lang="ts">
import {
  announcerCapability,
  type ContextMeterLevel,
  contextMeterConnect,
  contextMeterMachine,
  contextMeterMessages,
  partId,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { contextMeterContext } from "./context"
import type { ContextMeterRenderState, ContextMeterRootProps } from "./types"

const {
  used,
  max,
  warnAt,
  fullAt,
  announce,
  resetKey,
  onThreshold,
  formatOptions,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: ContextMeterRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability)
const messages = useMessages("context-meter", contextMeterMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const registry = usePartRegistry<"label">(
  untrack(() => ({ scope: "context-meter", root: instance })),
)
const labelId = $derived(partId("context-meter", instance, "label"))
const rendered = useRenderedId(registry, "label")
useMachine(
  contextMeterMachine,
  () => ({
    used,
    max,
    warnAt,
    fullAt,
    announce,
    resetKey,
    onThreshold: (l: ContextMeterLevel) => onThreshold?.(l),
    messages: messages(),
    id: instance,
    lang: locale.current.locale,
  }),
  env,
)
const api = $derived(
  contextMeterConnect({
    instance,
    used,
    max,
    warnAt,
    fullAt,
    locale: locale.current.locale,
    formatOptions,
    messages: messages(),
    ids: { label: rendered.current ?? labelId },
    rendered: { label: rendered.current !== undefined },
  }),
)
const meterState: ContextMeterRenderState = $derived({
  state: api.state,
  percent: api.percent,
  valueText: api.valueText,
})
contextMeterContext.set({
  api: () => api,
  state: () => meterState,
  registry,
  labelId: () => labelId,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: meterState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(meterState)}</div>
{/if}
