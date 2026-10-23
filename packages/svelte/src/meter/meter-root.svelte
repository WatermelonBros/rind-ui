<script lang="ts">
import {
  checkMeterValue,
  checkRangeName,
  type MeterValueTextArgs,
  meterConnect,
  meterMachine,
  meterMessages,
  meterZone,
  quirkActive,
  rangeValueText,
  resolveRangeValue,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import RangeFiller from "../range-filler.svelte"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { meterContext } from "./context"
import type { MeterRenderState, MeterRootProps } from "./types"

const {
  value,
  min,
  max,
  low,
  high,
  optimum,
  orientation = "horizontal",
  formatOptions,
  locale: ownLocale,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: MeterRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment()
const messages = useMessages("meter", meterMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const consumerNamed = $derived(
  rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
)
// A consumer name replaces the Label: then the Label is not expected on the server.
// Read once: the registry belongs to the instance.
const registry = usePartRegistry<"label">(
  untrack(() =>
    consumerNamed
      ? { scope: "meter", root: instance }
      : { scope: "meter", root: instance, expected: ["label"] },
  ),
)
useMachine(meterMachine, () => ({ value, min, max, low, high, optimum }))
const labelledBy = useRenderedId(registry, "label")
const range = $derived.by(() => {
  const resolved = resolveRangeValue({ value, min, max }, "meter")
  // A missing value renders as min (development error below): never indeterminate.
  return resolved.value === null ? { ...resolved, value: resolved.min } : resolved
})
const zone = $derived(meterZone(range, { low, high, optimum }))
const text = $derived(
  rangeValueText<MeterValueTextArgs>(
    range,
    { locale: locale.current.locale, formatOptions },
    messages().valueText,
    { zone },
  ),
)
const api = $derived(
  meterConnect({
    instance,
    range,
    zone,
    text,
    orientation,
    labelledBy: consumerNamed ? undefined : labelledBy.current,
  }),
)
const current: MeterRenderState = $derived({
  value: range.value ?? range.min,
  percent: range.percent,
  zone,
  valueText: text,
})
// After mount, once per change of what they read (the Label registers on its mount).
$effect(() => {
  checkRangeName(
    "meter",
    rest as Readonly<Record<string, unknown>>,
    labelledBy.current !== undefined || consumerNamed,
  )
})
$effect(() => checkMeterValue(value))
meterContext.set({ api: () => api, registry, instance: () => instance, state: () => current })
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
const filler = quirkActive("nvda-progressbar-name", env)
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}{#if filler}<RangeFiller />{/if}</div>
{/if}
