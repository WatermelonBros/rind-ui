<script lang="ts">
import {
  type AccordionEvent,
  type AccordionItemState,
  type ChangeDetails,
  type CollapsibleEvent,
  type PartProps as CorePartProps,
  describeKey,
  type HeadingLevel,
  type ItemKey,
  itemKey,
  type TriggerKeyEvent,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import {
  type CollapsibleDecoration,
  collapsibleContext,
  useCollapsibleService,
} from "../collapsible/service.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { accordionContext, accordionItem } from "./context"
import type { AccordionItemProps } from "./types"

const {
  value,
  disabled: own = false,
  closedContent,
  child,
  children,
  ...rest
}: AccordionItemProps = $props()
const root = accordionContext.get()
const env = useEnvironment()
const key = $derived(itemKey(value))
const disabled = $derived(own || root.disabled())
const focusable = $derived(!disabled || root.focusableWhenDisabled())
const open = $derived(root.openKeys().includes(key))
const idBase = $props.id()
const itemState: AccordionItemState = $derived({ item: key, open, disabled })
// Registered while mounted, again when its key or flags change.
$effect(() => {
  const item = key
  const isDisabled = disabled
  const isFocusable = focusable
  untrack(() =>
    root.send({ type: "ITEM.REGISTER", item, disabled: isDisabled, focusable: isFocusable }),
  )
})
$effect(() => {
  const item = key
  return () => untrack(() => root.send({ type: "ITEM.UNREGISTER", item }))
})
/** Collapsible's TOGGLE / OPEN / CLOSE proposals become the accordion's item events. */
function itemEvent(item: ItemKey, event: CollapsibleEvent): AccordionEvent {
  switch (event.type) {
    case "TOGGLE":
      return { type: "ITEM.TOGGLE", item, modality: event.modality }
    case "OPEN":
      return { type: "ITEM.OPEN", item, reason: event.reason }
    case "CLOSE":
      return { type: "ITEM.CLOSE", item, reason: event.reason }
    default: {
      const never: never = event
      return never
    }
  }
}
const decoration: CollapsibleDecoration = {
  trigger: () => {
    const t = root.api().trigger(itemState)
    const onKeyDown = t["onKeyDown"] as (e: TriggerKeyEvent) => void // set by connect
    return {
      ...t,
      onKeyDown: (e: KeyboardEvent) =>
        onKeyDown({
          ...describeKey(e, env),
          onTrigger: e.target === e.currentTarget,
          preventDefault: () => e.preventDefault(),
        }),
    } satisfies CorePartProps
  },
  content: (triggerId) => root.api().content(itemState, triggerId),
  indicator: () => root.api().indicator(),
  // A heading inside a panel is one level below its header.
  contentLevel: () => Math.min(root.level() + 1, 6) as HeadingLevel,
}
const ctx = useCollapsibleService({
  scope: "accordion",
  instance: root.instance,
  idBase: () => idBase,
  label: "Accordion",
  decoration,
  props: () => ({
    open,
    defaultOpen: undefined,
    // A proposal is always one of the collapsible's own events (never a system event).
    onOpenChange: (_open: boolean, details: ChangeDetails<CollapsibleEvent>) =>
      root.send(itemEvent(key, details.event as CollapsibleEvent)),
    disabled,
    focusableWhenDisabled: root.focusableWhenDisabled(),
    closedContent: closedContent ?? root.closedContent(),
  }),
})
$effect(() => {
  const item = key
  untrack(() => root.triggers.set(item, ctx.triggerEl))
  return () => root.triggers.delete(item)
})
accordionItem.set(() => itemState)
collapsibleContext.set(ctx)
const merged = $derived(stripMarker(mergeProps(normalizeProps(root.api().item(itemState)), rest)))
const current = $derived({ open, disabled })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
