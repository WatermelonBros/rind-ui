<script lang="ts">
import {
  type AccordionEvent,
  accordionConnect,
  accordionMachine,
  type ChangeDetails,
  focusSafely,
  type ItemKey,
  openKeysOf,
  resolveHeadingLevel,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { useHeadingContextLevel } from "../heading/context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { accordionContext } from "./context"
import type { AccordionRootProps } from "./types"

/** The default header level outside any `Heading.Level` (spec "Heading Structure"). */
const DEFAULT_HEADER_LEVEL = 3

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  multiple = false,
  collapsible = true,
  disabled = false,
  focusableWhenDisabled = false,
  keyboardNavigation = false,
  orientation = "vertical",
  dir: ownDir,
  headingLevel,
  closedContent = "until-found",
  contentRole,
  id,
  child,
  children,
  ...rest
}: AccordionRootProps = $props()

const env = useEnvironment()
const locale = useLocale(
  () => undefined,
  () => ownDir,
)
const uid = $props.id()
const instance = $derived(id ?? uid)
const triggers = new Map<ItemKey, { current: Element | null }>()
const machine = useMachine(accordionMachine, () => ({
  value,
  defaultValue,
  onValueChange: (next: readonly string[], details: ChangeDetails<AccordionEvent>) => {
    let cancelled = false
    onValueChange?.(next, {
      ...details,
      cancel: () => {
        cancelled = true
        details.cancel()
      },
    })
    if (!cancelled && value !== undefined) value = next
  },
  multiple,
  collapsible,
  disabled,
  keyboardNavigation,
  // Document order of the triggers, whatever the mount order or closed-content mode.
  triggerOrder: (items: readonly ItemKey[]) =>
    [...items].sort((a, b) => {
      const x = triggers.get(a)?.current
      const y = triggers.get(b)?.current
      if (!x || !y) return 0
      return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    }),
  focusTrigger: (item: ItemKey) => {
    const el = triggers.get(item)?.current
    if (el instanceof HTMLElement) void focusSafely(el, env)
  },
}))
const context = useHeadingContextLevel()
const level = $derived(resolveHeadingLevel(headingLevel, context() ?? DEFAULT_HEADER_LEVEL))
const openKeys = $derived(openKeysOf(machine.view.values.value ?? [], multiple))
const api = $derived(
  accordionConnect(
    {
      instance,
      orientation,
      dir: locale.current.dir,
      platform: env.platform,
      disabled,
      multiple,
      collapsible,
      keyboardNavigation,
      itemCount: machine.view.context.items.size,
      contentRole,
    },
    machine.send,
  ),
)
accordionContext.set({
  instance: () => instance,
  send: machine.send,
  openKeys: () => openKeys,
  api: () => api,
  disabled: () => disabled,
  focusableWhenDisabled: () => focusableWhenDisabled,
  closedContent: () => closedContent,
  level: () => level,
  triggers,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
const current = $derived({ value: openKeys, disabled })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
