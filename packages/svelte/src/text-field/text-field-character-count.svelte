<script lang="ts">
import { defaultCount } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { textFieldContext } from "./context"
import type { TextFieldCharacterCountProps } from "./types"

const { max, count, id, child, ...rest }: TextFieldCharacterCountProps = $props()
const ctx = textFieldContext.get()
const own = $derived(id ?? `${ctx.scope}-${ctx.instance()}-character-count`.replace(/:/g, ""))
// After mount, like React's layout effect (the server render shows the count alone).
$effect(() => {
  const next = { id: own, max, count }
  untrack(() => ctx.setCount(next))
  return () => untrack(() => ctx.setCount(null))
})
// On mount and when the limit or counter changes (a change writes it before reporting).
$effect(() => {
  void ctx.limit()
  void count
  untrack(() => ctx.applySoftLimit(ctx.controlEl.current?.value ?? ""))
})
const used = $derived((count ?? defaultCount)(ctx.view().values.value ?? ""))
const limit = $derived(ctx.limit())
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps({
        "data-scope": ctx.scope,
        "data-part": "character-count",
        "data-instance": ctx.instance(),
        id: own,
        "data-over-limit": limit !== undefined && used > limit ? "" : undefined,
      }),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{limit === undefined ? used : `${used}/${limit}`}</span>
{/if}
