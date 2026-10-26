<script lang="ts">
import { type DateSegmentType, dateFieldKey, describeKey, planSegmentInput } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLInputAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { popoverHost } from "../popover/context.svelte"
import { useEnvironment } from "../provider"
import { rangeTriggers, useApi, useDateField } from "./context"
import type { DateFieldSegmentProps } from "./types"

// One segment: an input for an editable segment or the zone, a hidden span for a literal.
const { segment, child, ...rest }: DateFieldSegmentProps = $props()
const ctx = useDateField("Segment")
const api = useApi(ctx)
const env = useEnvironment()
const popover = popoverHost.maybe() ?? null
// A range's triggers, set above its embedded ends (Alt+ArrowDown).
const range = rangeTriggers.maybe() ?? null
const type = $derived(segment.type as DateSegmentType)
// `beforeinput`: insertions are planned before they apply.
const planned = (node: HTMLElement) => {
  const onBeforeInput = (e: Event) => {
    const ie = e as InputEvent
    if (ctx.view().matches("composing") || ie.isComposing) return
    const plan = planSegmentInput({ data: ie.data, inputType: ie.inputType }, type)
    if (plan.cancel) e.preventDefault()
    if (plan.event) ctx.send(plan.event)
  }
  node.addEventListener("beforeinput", onBeforeInput)
  return () => node.removeEventListener("beforeinput", onBeforeInput)
}
// A literal: the server's formatter may differ from the browser's in a literal only (a space
// before AM/PM): corrected to the browser's text after mount.
const literal = (node: HTMLElement) => {
  $effect(() => {
    if (node.textContent !== segment.text) node.textContent = segment.text
  })
}
const handlers = {
  onfocus: (e: FocusEvent) => {
    ctx.selectAll.current = false
    ctx.send({ type: "SEGMENT.FOCUS", segment: type, modality: env.modality.modality() })
    // The whole text selected, as the native control highlights its sub-field.
    ;(e.currentTarget as HTMLInputElement).select()
  },
  onblur: (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null
    const inside = next !== null && ctx.inputEl.current?.contains(next) === true
    ctx.send({ type: "SEGMENT.BLUR", related: inside ? "segment" : "outside" })
  },
  onkeydown: (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    const event = dateFieldKey(describeKey(e, env), type, {
      dir: ctx.dir(),
      platform: env.platform,
      selectAll: ctx.selectAll.current,
    })
    if (event === "select-all") {
      ctx.selectAll.current = true
      return
    }
    if (event === "settle") {
      // Not prevented: the form's implicit submission follows, with the value committed.
      ctx.send({ type: "SETTLE" })
      return
    }
    if (event === "open-picker") {
      // Only a picker opens; otherwise the key is the browser's. A range's ends are embedded:
      // their host's triggers count.
      const count = ctx.embedded ? (range?.count ?? 0) : ctx.picker.triggers.count
      if (count === 0 || !popover || popover.view().matches("open")) return
      e.preventDefault()
      popover.service.send({ type: "trigger", modality: "keyboard" })
      return
    }
    ctx.selectAll.current = false
    if (!event) return
    e.preventDefault()
    // Embedded: select all + Backspace clears the host's pair, even when this field's own value
    // does not change (a partial end).
    if (typeof event === "object" && event.type === "CLEAR_ALL") ctx.onClearAll()
    ctx.send(event)
  },
  oncompositionstart: () => ctx.send({ type: "COMPOSITION.START" }),
  oncompositionend: (e: CompositionEvent) =>
    ctx.send({ type: "COMPOSITION.END", segment: type, text: e.data }),
  onpaste: (e: ClipboardEvent) => {
    e.preventDefault()
    if (ctx.disabled() || ctx.readOnly()) return
    ctx.send({ type: "PASTE", text: e.clipboardData?.getData("text") ?? "" })
  },
  oncopy: (e: ClipboardEvent) => {
    e.preventDefault()
    e.clipboardData?.setData("text/plain", api().copyText(type))
  },
}
const own = $derived(normalizeProps(api().segment(segment)))
const merged = $derived(
  stripMarker(
    mergeProps(
      segment.type === "literal" || segment.type === "timeZoneName"
        ? own
        : joinHandlers(own, handlers),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else if segment.type === "literal"}
  <span {...attrs(merged)} {@attach literal}>{segment.text}</span>
{:else if segment.type === "timeZoneName"}
  <input {...merged as HTMLInputAttributes} defaultValue={merged["value"] as string} />
{:else}
  <!-- The value attribute follows the text (as React's controlled input). -->
  <input {...merged as HTMLInputAttributes} defaultValue={merged["value"] as string} {@attach planned} />
{/if}
