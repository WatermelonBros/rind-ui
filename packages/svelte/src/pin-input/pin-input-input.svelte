<script lang="ts">
import {
  type FieldControlBinding,
  focusSafely,
  injectStyle,
  pinInputStyle,
  planEdit,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useFieldControl } from "../field/context.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { pinInputContext, stateOf, useApi } from "./context.svelte"
import type { PinInputInputProps } from "./types"

const { id, child, ...rest }: PinInputInputProps = $props()
const ctx = pinInputContext.get()
const env = useEnvironment()
const uid = $props.id()
const binding = useFieldControl(uid)
const apiFor = useApi(ctx, binding)
const controlId = $derived(
  id ?? binding?.().controlId ?? `pin-input-${ctx.instance()}-input`.replace(/:/g, ""),
)
const report = (e: Parameters<FieldControlBinding["report"]>[0]) => binding?.().report(e)
const value = $derived(ctx.view().values.value)
$effect(() => {
  if (!binding) return
  const cid = controlId
  return untrack(() =>
    binding().register(
      {
        id: cid,
        labelable: true,
        focus: (m) => {
          if (ctx.inputEl.current) void focusSafely(ctx.inputEl.current, env, "programmatic", m)
        },
        // The input is the form control: its own validity (valueMissing, patternMismatch).
        validityElement: () => ctx.inputEl.current,
        value: () => ctx.view().values.value,
      },
      cid,
    ),
  )
})
// Each applied change is reported to the Field once.
let reported = untrack(() => value)
$effect(() => {
  const now = value
  untrack(() => {
    if (reported === now) return
    reported = now
    // A reset or a parent's value is reported too, but not as the user's (RA#6830).
    const user = ctx.userChange.current
    ctx.userChange.current = false
    report({ type: "change", value: now, user, composing: false })
  })
})
// After every update: the DOM shows the value, the planned caret is placed, and a pending
// auto-submit runs against the full code.
$effect(() => {
  const now = value
  void ctx.view().context.caret
  void ctx.view().context.focused
  untrack(() => {
    const el = ctx.inputEl.current
    if (!el) return
    // The DOM text follows the value between compositions (an IME owns it meanwhile).
    if (el.value !== now && !ctx.view().matches("composing")) el.value = now
    // Kept until the input has focus (a press focuses it after the caret was planned).
    const caret = ctx.pendingCaret.current
    if (caret !== null && el.ownerDocument.activeElement === el) {
      el.setSelectionRange(caret, caret)
      ctx.pendingCaret.current = null
    }
    if (ctx.pendingSubmit.current) {
      ctx.pendingSubmit.current = false
      el.form?.requestSubmit()
    }
  })
})
/** The slot whose box holds `x` (nearest when between two), by `data-instance`. */
function slotAt(input: HTMLInputElement, instance: string, x: number): number | null {
  const control = input.parentElement
  if (!control) return null
  // A press outside the control (a synthetic click without coordinates) is not on a slot.
  const box = control.getBoundingClientRect()
  if (box.width > 0 && (x < box.left || x > box.right)) return null
  let best: { index: number; distance: number } | null = null
  let laidOut = false
  for (const el of control.querySelectorAll<HTMLElement>(
    `[data-scope="pin-input"][data-part="slot"][data-instance="${CSS.escape(instance)}"]`,
  )) {
    const r = el.getBoundingClientRect()
    if (r.width > 0) laidOut = true
    const distance = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
    const index = Number(el.dataset["index"])
    if (!best || distance < best.distance) best = { index, distance }
  }
  // No layout (jsdom): the browser's own caret placement stands.
  return laidOut ? (best?.index ?? null) : null
}
const capture = (el: HTMLInputElement) => {
  ctx.inputEl.current = el
  injectStyle(el.ownerDocument, "pin-input", pinInputStyle, env)
  const current = () => ctx.view().values.value
  const onBeforeInput = (e: Event) => {
    const ie = e as InputEvent
    if (ctx.view().matches("composing") || ie.isComposing) return
    if (ie.inputType === "insertCompositionText") return
    const data = ie.data ?? ie.dataTransfer?.getData("text/plain") ?? null
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? start
    const plan = planEdit(current(), [start, end], { inputType: ie.inputType, data }, ctx.rules())
    if (plan.accept && plan.edit === null) return
    e.preventDefault()
    ctx.send(plan.accept ? { type: "EDIT", edit: plan.edit } : { type: "INVALID", text: plan.text })
  }
  const onInput = (e: Event) => {
    const ie = e as Partial<InputEvent>
    if (ctx.view().matches("composing") || ie.isComposing) return
    if (el.value === current()) return
    const native = typeof ie.inputType === "string" && /^(delete|history)/.test(ie.inputType)
    ctx.send({ type: "INPUT", text: el.value, reason: native ? "INPUT" : "AUTOFILL" })
  }
  // A key an IME owns (isComposing, keyCode 229) never moves the active slot. Its
  // selectionchange arrives as a later task, so the flag holds until the next own key,
  // a press or the composition's end.
  let imeKey = false
  const onKeyDown = (e: Event) => {
    const k = e as KeyboardEvent
    imeKey = k.isComposing || k.keyCode === 229
  }
  const onSettled = () => {
    imeKey = false
  }
  const onSelection = () => {
    if (imeKey || el.ownerDocument.activeElement !== el || el.selectionStart === null) return
    if (el.selectionStart !== ctx.view().context.caret)
      ctx.send({ type: "CARET", index: el.selectionStart })
  }
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || ctx.disabled()) return
    const index = slotAt(el, ctx.instance(), e.clientX)
    if (index === null) return
    // No native caret placement: the caret goes to the slot under the press.
    e.preventDefault()
    if (el.ownerDocument.activeElement !== el) void focusSafely(el, env, "programmatic")
    ctx.send({
      type: "SLOT.PRESS",
      index,
      modality: e.pointerType === "touch" ? "touch" : "pointer",
    })
  }
  // A form reset: the current defaultValue comes back (read once dispatch ended).
  const formEl = el.form
  const onReset = (e: Event) =>
    env.scheduler.setTimeout(() => {
      if (!e.defaultPrevented) ctx.send({ type: "RESET" })
    }, 0)
  el.addEventListener("beforeinput", onBeforeInput)
  el.addEventListener("input", onInput)
  el.addEventListener("pointerdown", onPointerDown)
  el.addEventListener("keydown", onKeyDown, true)
  el.addEventListener("pointerdown", onSettled, true)
  el.addEventListener("compositionend", onSettled)
  el.ownerDocument.addEventListener("selectionchange", onSelection)
  formEl?.addEventListener("reset", onReset)
  return () => {
    el.removeEventListener("beforeinput", onBeforeInput)
    el.removeEventListener("input", onInput)
    el.removeEventListener("pointerdown", onPointerDown)
    el.removeEventListener("keydown", onKeyDown, true)
    el.removeEventListener("pointerdown", onSettled, true)
    el.removeEventListener("compositionend", onSettled)
    el.ownerDocument.removeEventListener("selectionchange", onSelection)
    formEl?.removeEventListener("reset", onReset)
    if (ctx.inputEl.current === el) ctx.inputEl.current = null
  }
}
const handlers = {
  onkeydown: (e: KeyboardEvent) => {
    // Enter is never prevented (zag#3381); outside an IME it commits for the Field.
    if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) report({ type: "commit" })
  },
  oncompositionstart: (e: CompositionEvent) => {
    const el = e.currentTarget instanceof HTMLInputElement ? e.currentTarget : null
    ctx.send({ type: "COMPOSITION.START", caret: el?.selectionStart ?? value.length })
  },
  oncompositionend: (e: CompositionEvent) => ctx.send({ type: "COMPOSITION.END", text: e.data }),
  onfocus: () => {
    // Focus (Tab selects the text natively) lands on the collapsed caret, unless a press
    // already planned one.
    if (ctx.pendingCaret.current === null)
      ctx.pendingCaret.current = Math.min(ctx.view().context.caret, value.length)
    ctx.send({ type: "FOCUS", modality: env.modality.modality() })
  },
  onblur: () => ctx.send({ type: "BLUR" }),
}
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps({ ...apiFor().input(), id: controlId }), handlers),
      rest,
    ),
  ),
)
const current = $derived(stateOf(ctx))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <input {...attrs(merged)} {@attach capture} />
{/if}
