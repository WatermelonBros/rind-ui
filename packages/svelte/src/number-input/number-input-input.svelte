<script lang="ts">
import {
  describeKey,
  type FieldControlBinding,
  focusSafely,
  numberInputKey,
  partId,
  planInsertion,
  quirkActive,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useFieldControl } from "../field/context.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { stateOf, useApi } from "./api.svelte"
import { numberInputContext } from "./context"
import type { NumberInputInputProps } from "./types"

const { id, inputmode, child, ...rest }: NumberInputInputProps = $props()
const ctx = numberInputContext.get()
const env = useEnvironment()
const uid = $props.id()
const binding = useFieldControl(uid)
const apiFor = useApi(ctx, binding)
const controlId = $derived(
  id ?? binding?.().controlId ?? partId("number-input", ctx.instance(), "input"),
)
// After mount, as React: the server HTML keeps the provisional id (docs/review-backlog.md).
$effect(() => {
  const next = controlId
  untrack(() => ctx.setInputId(next))
})
const report = (e: Parameters<FieldControlBinding["report"]>[0]) => binding?.().report(e)
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
        validityElement: () => ctx.hiddenEl.current,
        value: () => ctx.view().values.value ?? null,
      },
      cid,
    ),
  )
})
// Each applied change is reported to the Field once (spec "Field Integration").
const value = $derived(ctx.view().values.value ?? null)
let reported = untrack(() => value)
$effect(() => {
  const now = value
  untrack(() => {
    if (Object.is(reported, now)) return
    reported = now
    report({ type: "change", value: now, user: true, composing: false })
  })
})
// Insertions are checked before they apply.
let caret: number | null = null
const keypadLocale = () =>
  quirkActive("keypad-decimal-separator", env)
    ? (globalThis.navigator?.language ?? "en")
    : undefined
const capture = (el: HTMLInputElement) => {
  ctx.inputEl.current = el
  const onBeforeInput = (e: Event) => {
    const ie = e as InputEvent
    if (ctx.view().matches("composing") || ie.isComposing) return
    const min = ctx.min()
    const plan = planInsertion(
      {
        text: el.value,
        selectionStart: el.selectionStart ?? el.value.length,
        selectionEnd: el.selectionEnd ?? el.value.length,
        data: ie.data,
        inputType: ie.inputType,
      },
      ctx.parser(),
      { allowNegative: min === undefined || min < 0, keypadLocale: keypadLocale() },
    )
    if (plan.kind === "accept") return
    e.preventDefault()
    if (plan.kind === "replace") {
      caret = plan.caret
      ctx.send({ type: "INPUT", text: plan.text })
    }
  }
  el.addEventListener("beforeinput", onBeforeInput)
  return () => {
    el.removeEventListener("beforeinput", onBeforeInput)
    if (ctx.inputEl.current === el) ctx.inputEl.current = null
  }
}
$effect(() => {
  void ctx.view().context.text
  const el = ctx.inputEl.current
  untrack(() => {
    if (caret === null || !el) return
    el.setSelectionRange(caret, caret)
    caret = null
  })
})
// The wheel steps the focused input only, vertically, without Ctrl (react-spectrum#1792).
$effect(() => {
  const el = ctx.inputEl.current
  if (!el || !ctx.view().context.focused || !ctx.allowWheel()) return
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || ctx.disabled() || ctx.readOnly()) return
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.deltaY === 0) return
    e.preventDefault()
    ctx.send({ type: "WHEEL", direction: e.deltaY < 0 ? 1 : -1, large: e.shiftKey })
  }
  el.addEventListener("wheel", onWheel, { passive: false })
  return () => el.removeEventListener("wheel", onWheel)
})
const handlers = {
  oninput: (e: Event) => {
    if (e.currentTarget instanceof HTMLInputElement)
      ctx.send({ type: "INPUT", text: e.currentTarget.value })
  },
  onkeydown: (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    const event = numberInputKey(describeKey(e, env), {
      hasMin: ctx.min() !== undefined,
      hasMax: ctx.max() !== undefined,
    })
    if (!event) return
    if (event.type === "COMMIT") {
      // Commit first, then the browser's implicit submission sends the new value.
      ctx.send(event)
      report({ type: "commit" })
      return
    }
    e.preventDefault()
    ctx.send(event)
  },
  onpaste: (e: ClipboardEvent) => {
    const el = e.currentTarget
    if (!(el instanceof HTMLInputElement)) return
    const whole =
      el.value === "" ||
      ((el.selectionStart ?? 0) === 0 && (el.selectionEnd ?? 0) === el.value.length)
    if (!whole || ctx.disabled() || ctx.readOnly()) return
    const text = e.clipboardData?.getData("text") ?? ""
    e.preventDefault()
    if (ctx.parser().parse(text) !== null) ctx.send({ type: "PASTE", text })
  },
  oncompositionstart: () => ctx.send({ type: "COMPOSITION.START" }),
  oncompositionend: (e: CompositionEvent) => {
    if (e.currentTarget instanceof HTMLInputElement)
      ctx.send({ type: "COMPOSITION.END", text: e.currentTarget.value })
  },
  onfocus: () => ctx.send({ type: "FOCUS", modality: env.modality.modality() }),
  onblur: () => ctx.send({ type: "BLUR" }),
}
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(
        normalizeProps({
          ...apiFor().input(),
          id: controlId,
          ...(inputmode === undefined || inputmode === null ? {} : { inputmode }),
        }),
        handlers,
      ),
      rest,
    ),
  ),
)
const current = $derived(stateOf(ctx))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- The value attribute follows the text (as React's controlled input): a form reset restores
  the current text, and the machine's RESET then formats the default. -->
  <input {...attrs(merged)} defaultValue={merged["value"] as string} {@attach capture} />
{/if}
