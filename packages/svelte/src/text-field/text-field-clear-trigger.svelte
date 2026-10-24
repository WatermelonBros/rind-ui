<script lang="ts">
import { injectStyle, textFieldCancelStyle } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { usePress } from "../use-press.svelte"
import { textFieldContext } from "./context"
import type { TextFieldClearTriggerProps } from "./types"

// The ClearTrigger; with `type="search"`, the browser's own cancel button is hidden meanwhile.
const { child, children, ...rest }: TextFieldClearTriggerProps = $props()
const ctx = textFieldContext.get()
const env = useEnvironment()
// Mounted, rendered or not: the browser's own clear control is hidden meanwhile.
$effect(() =>
  untrack(() => {
    ctx.setMounted("clearTriggers", 1)
    if (ctx.own().type === "search") {
      injectStyle(
        ctx.controlEl.current?.ownerDocument,
        "text-field-cancel",
        textFieldCancelStyle,
        env,
      )
    }
    return () => ctx.setMounted("clearTriggers", -1)
  }),
)
const press = usePress({
  env,
  // Pressing never moves focus away from the input.
  focusOnPress: false,
  send: (e) => {
    if (e.type === "PRESS") ctx.send({ type: "CLEAR", modality: e.modality, reason: "CLEAR" })
  },
})
const clearable = $derived(
  !ctx.disabled() &&
    !ctx.readOnly() &&
    !ctx.focusableWhenDisabled() &&
    (ctx.view().values.value ?? "") !== "",
)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps({
          "data-scope": ctx.scope,
          "data-part": "clear-trigger",
          "data-instance": ctx.instance(),
          type: "button",
          "aria-label":
            ctx.own().type === "search" ? ctx.messages().clearSearch : ctx.messages().clear,
          tabindex: -1,
        }),
        ...press.props,
      },
      rest,
    ),
  ),
)
</script>

{#if clearable}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <button {...merged as HTMLButtonAttributes}>{@render children?.()}</button>
  {/if}
{/if}
