<script lang="ts">
import { blurEvent, describeKey, focusEvent } from "@rind-ui/core"
import { colorAreaKeyEvent } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { joinHandlers } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type Axis, colorArea } from "./context"

// One axis input (x or y): the focusable `slider`s, inside the Thumb.
const { axis }: { axis: Axis } = $props()
const ctx = colorArea.get()
const env = useEnvironment()
$effect(() =>
  untrack(() =>
    ctx.formInput(axis).track({
      onReset: () => ctx.send({ type: "RESET" }),
      resetsWithForm: axis === "x",
      current: () => ({ value: String(ctx.shown()[axis]) }),
      onNativeInput: (input) => {
        ctx.send({ type: "INPUT.CHANGE", axis, value: Number(input.value) })
        return true
      },
    }),
  ),
)
const ref = (el: HTMLInputElement) => {
  ctx.inputs[axis] = el
  return () => {
    if (ctx.inputs[axis] === el) ctx.inputs[axis] = null
  }
}
const inputProps = $derived(
  joinHandlers(normalizeProps(ctx.api().input(axis)), {
    onkeydown: (e: KeyboardEvent) => {
      const event = colorAreaKeyEvent(describeKey(e, env), {
        dir: ctx.dir(),
        dragging: ctx.state().dragging,
      })
      if (!event || e.defaultPrevented) return
      e.preventDefault()
      // Escape ends the drag only: a surrounding layer stays open.
      if (event.type === "DRAG.CANCEL") e.stopPropagation()
      ctx.send(event)
    },
    onfocus: (e: FocusEvent) =>
      ctx.send({ ...focusEvent(e.currentTarget as Element, env.modality), axis }),
    onblur: () => ctx.send({ ...blurEvent(env.modality), axis }),
  }),
)
</script>

<input {...attrs(inputProps)} {@attach ref} />
