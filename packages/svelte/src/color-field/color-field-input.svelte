<script lang="ts">
import { describeKey, focusSafely } from "@rind-ui/core"
import { acceptColorText, colorFieldKeyEvent, stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLInputAttributes } from "svelte/elements"
import { useFieldControl } from "../field/context.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { colorField } from "./context"
import type { ColorFieldInputProps } from "./types"

// The text input: free text until Enter, blur or a flush.
const { id, child, ...rest }: ColorFieldInputProps = $props()
const ctx = colorField.get()
const env = useEnvironment()
const uid = $props.id()
const binding = useFieldControl(uid)
const controlId = $derived(id ?? binding?.().controlId ?? (ctx.api().input()["id"] as string))
$effect(() => {
  const cid = controlId
  if (!binding || typeof cid !== "string") return
  return untrack(() =>
    binding().register(
      {
        id: cid,
        labelable: true,
        focus: (m) => {
          if (ctx.inputEl.current) void focusSafely(ctx.inputEl.current, env, "programmatic", m)
        },
        validityElement: () => ctx.hiddenEl.current,
        value: () => ctx.value(),
      },
      cid,
    ),
  )
})
// The resulting text is checked before it applies.
const ref = (el: HTMLInputElement) => {
  ctx.inputEl.current = el
  const onBeforeInput = (e: Event) => {
    const ie = e as InputEvent
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const pasted = ie.inputType === "insertFromPaste" || ie.inputType === "insertFromDrop"
    if (!ie.inputType.startsWith("insert") || ie.data === null) return
    const data = pasted ? ie.data.trim() : ie.data
    const next = el.value.slice(0, start) + data + el.value.slice(end)
    if (acceptColorText(next, ctx.format(), ctx.alpha())) {
      if (pasted && data !== ie.data) {
        e.preventDefault()
        ctx.send({ type: "INPUT", text: next })
      }
      return
    }
    e.preventDefault()
  }
  el.addEventListener("beforeinput", onBeforeInput)
  return () => {
    el.removeEventListener("beforeinput", onBeforeInput)
    if (ctx.inputEl.current === el) ctx.inputEl.current = null
  }
}
const handlers = {
  // Devices that do not cancel `beforeinput` (Android composition): checked again here.
  oninput: (e: Event) => {
    const el = e.currentTarget as HTMLInputElement
    const text = el.value
    if (acceptColorText(text, ctx.format(), ctx.alpha())) ctx.send({ type: "INPUT", text })
    else el.value = ctx.api().text
  },
  onkeydown: (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    const event = colorFieldKeyEvent(describeKey(e, env), ctx.state().dirty)
    if (!event) return
    // Escape reverts a dirty draft only: the layer around stays open (handled Escape).
    if (event.type === "ESCAPE") e.preventDefault()
    ctx.send(event)
  },
  onfocus: () => ctx.setFocused(true),
  onblur: () => {
    ctx.setFocused(false)
    ctx.send({ type: "BLUR" })
  },
}
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps({ ...ctx.api().input(), id: controlId }), handlers),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <!-- The value attribute follows the text (as React's controlled input). -->
  <input {...merged as HTMLInputAttributes} defaultValue={merged["value"] as string} {@attach ref} />
{/if}
