<script lang="ts">
import { type DateSegmentType, focusSafely, segmentAtPress, segmentId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useFieldControl } from "../field/context.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { inControl, useApi, useDateField } from "./context"
import Segment from "./date-field-segment.svelte"
import type { DateFieldInputProps } from "./types"

// The group of segments, its hidden segment names and value description.
const { child, children, ...rest }: DateFieldInputProps = $props()
const ctx = useDateField("Input")
const env = useEnvironment()
const uid = $props.id()
// An embedded field is not the Field's control (its host is): it claims nothing.
const binding = useFieldControl(uid, { skip: ctx.embedded })
const api = useApi(ctx)
const control = inControl.maybe() ?? false
const firstId = $derived.by(() => {
  const first = api()
    .segments()
    .find((s) => s.editable)
  return first ? segmentId(ctx.instance, first.type as DateSegmentType) : undefined
})
$effect(() => {
  const id = firstId
  if (!binding || ctx.embedded || !id) return
  return untrack(() =>
    binding().register(
      {
        id,
        labelable: false,
        focus: (m) => {
          const el = ctx.inputEl.current?.ownerDocument.getElementById(id)
          if (el) void focusSafely(el, env, "programmatic", m)
        },
        validityElement: () => ctx.hiddenEl.current,
        value: () => ctx.view().values.value ?? null,
      },
      id,
    ),
  )
})
// Each commit that changed the value or the field's own validity is reported to the Field once
// (date-field "Field Integration"): an impossible date leaves the value null but must still be
// validated when the user leaves.
let reported = untrack(() => ({
  value: ctx.view().values.value ?? null,
  reason: api().validity.reason,
}))
$effect(() => {
  const value = ctx.view().values.value ?? null
  const reason = api().validity.reason
  untrack(() => {
    if (reported.value === value && reported.reason === reason) return
    reported = { value, reason }
    if (!ctx.embedded) binding?.().report({ type: "change", value, user: true, composing: false })
  })
})
const handlers = {
  // A press on the group outside a segment: the last filled segment before it (pointer only).
  onpointerdown: (e: PointerEvent) => {
    const root = ctx.inputEl.current
    if (!root || ctx.disabled() || (e.target as Element).closest("input")) return
    const el = segmentAtPress(root, e.clientX, ctx.dir())
    if (!el) return
    e.preventDefault()
    void focusSafely(el, env, "programmatic", "pointer")
  },
  // The press's mousedown would move focus to the body (the group is not focusable).
  onmousedown: (e: MouseEvent) => {
    if (!(e.target as Element).closest("input")) e.preventDefault()
  },
}
const ref = (node: HTMLElement) => {
  ctx.inputEl.current = node
  return () => {
    if (ctx.inputEl.current === node) ctx.inputEl.current = null
  }
}
const a = $derived(api())
const merged = $derived(
  stripMarker(
    mergeProps(joinHandlers(normalizeProps(a.input({ inControl: control })), handlers), rest),
  ),
)
const segments = $derived(ctx.state().segments)
const description = $derived(a.valueDescription())
</script>

{#snippet content()}{#if children}{@render children(segments)}{:else}{#each segments as s (s.key)}<Segment
        segment={s}
      />{/each}{/if}{#each a.segmentNames() as n (n.key)}<span {...attrs(normalizeProps(n.props))} aria-hidden="true"
      >{n.text}</span
    >{/each}{#if description}<span {...attrs(normalizeProps(description.props))} aria-hidden="true"
      >{description.text}</span
    >{/if}{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: content }, state: ctx.state() })}
{:else}
  <div {...attrs(merged)} {@attach ref}>{@render content()}</div>
{/if}
