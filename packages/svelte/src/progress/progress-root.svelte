<script lang="ts">
import {
  announcerCapability,
  checkRangeName,
  progressConnect,
  progressMachine,
  progressMessages,
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
import { progressContext } from "./context"
import type { ProgressRenderState, ProgressRootProps } from "./types"

const {
  value = null,
  min,
  max,
  orientation = "horizontal",
  formatOptions,
  locale: ownLocale,
  announceCompletion,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: ProgressRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability)
const messages = useMessages("progress", progressMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const consumerNamed = $derived(
  rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
)
// A consumer name replaces the Label: then the Label is not expected on the server.
// Read once: the registry belongs to the instance.
const registry = usePartRegistry<"label">(
  untrack(() =>
    consumerNamed
      ? { scope: "progress", root: instance }
      : { scope: "progress", root: instance, expected: ["label"] },
  ),
)
useMachine(
  progressMachine,
  () => ({
    value,
    min,
    max,
    announceCompletion,
    messages: messages(),
    id: instance,
    lang: locale.current.locale,
  }),
  env,
)
const labelledBy = useRenderedId(registry, "label")
const range = $derived(resolveRangeValue({ value, min, max }, "progress"))
const text = $derived(
  rangeValueText(range, { locale: locale.current.locale, formatOptions }, messages().valueText),
)
const api = $derived(
  progressConnect({
    instance,
    range,
    text,
    orientation,
    labelledBy: consumerNamed ? undefined : labelledBy.current,
  }),
)
const current: ProgressRenderState = $derived({
  state: api.state,
  value: range.value,
  percent: range.percent,
  valueText: text,
})
// After mount, once per change of what it reads (the Label registers on its mount).
$effect(() => {
  checkRangeName(
    "progress",
    rest as Readonly<Record<string, unknown>>,
    labelledBy.current !== undefined || consumerNamed,
  )
})
progressContext.set({ api: () => api, registry, instance: () => instance, state: () => current })
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
