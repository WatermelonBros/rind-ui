<script lang="ts">
import {
  checkLabelTarget,
  labelConnect,
  labelForwardsFocus,
  labelInteraction,
  labelTarget,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLLabelAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import type { LabelProps } from "./types"

const { for: ownFor, id, child, children, ...rest }: LabelProps = $props()
const htmlFor = $derived(ownFor ?? undefined)

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment()
const el = elementRef("label")
// Known after mount only: the server keeps the consumer's `for`.
let nonLabelable = $state(false)
$effect(() => {
  if (el.current) nonLabelable = checkLabelTarget(el.current, htmlFor)
})
const forwardsFocus = $derived(labelForwardsFocus(el.tag, nonLabelable))
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          labelConnect({ instance, id: instance, htmlFor, tag: el.tag, forwardsFocus }),
        ),
        ...normalizeProps(
          labelInteraction(env, {
            target: () => (el.current ? labelTarget(el.current, htmlFor) : null),
            forwardsFocus: () => forwardsFocus,
          }),
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <!-- Connect's props are the label's attributes and handlers. -->
  <label {...merged as HTMLLabelAttributes}>{@render children?.()}</label>
{/if}
