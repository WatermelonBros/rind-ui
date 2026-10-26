<script lang="ts">
import type { MessageActionsButtonInput, PartProps } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import ToolbarItem from "../toolbar/toolbar-item.svelte"
import { useModality } from "../use-modality.svelte"
import { messageActionsContext, withoutScope } from "./context"
import type { MessageActionsButtonProps } from "./types"

/** A Toolbar item with this component's attributes (Regenerate, Edit, the version buttons). */
const {
  kind,
  children,
  ...rest
}: MessageActionsButtonProps & {
  kind: "regenerate" | "edit" | "versionPrevious" | "versionNext"
} = $props()
const ctx = messageActionsContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const EVENT = {
  regenerate: "PRESS.REGENERATE",
  edit: "PRESS.EDIT",
  versionPrevious: "PRESS.PREVIOUS",
  versionNext: "PRESS.NEXT",
} as const
const own = $derived.by((): PartProps => {
  const b: MessageActionsButtonInput = { tag: "button", focused, modality: modality.current }
  return ctx.api()[kind](b)
})
const attachEdit = (node: HTMLElement) => {
  if (kind !== "edit") return
  ctx.editEl.current = node
  return () => {
    if (ctx.editEl.current === node) ctx.editEl.current = null
  }
}
const merge = (toolbar: Record<string, unknown>) =>
  stripMarker(
    mergeProps(
      withoutScope(toolbar),
      joinHandlers(normalizeProps(own), {
        onclick: (e: MouseEvent) => {
          if ((e.currentTarget as HTMLElement).hasAttribute("data-disabled")) return
          ctx.send({ type: EVENT[kind] })
        },
        onfocus: () => (focused = true),
        onblur: () => (focused = false),
      }),
      rest,
    ),
  )
</script>

<ToolbarItem focusableWhenDisabled>
  {#snippet child({ props })}
    <button {...merge(props) as HTMLButtonAttributes} {@attach attachEdit}>{@render children?.()}</button>
  {/snippet}
</ToolbarItem>
