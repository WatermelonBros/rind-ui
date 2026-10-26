<script lang="ts">
import ClipboardRoot from "../clipboard/clipboard-root.svelte"
import ClipboardTrigger from "../clipboard/clipboard-trigger.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import ToolbarItem from "../toolbar/toolbar-item.svelte"
import { messageActionsContext, withoutScope } from "./context"
import type { MessageActionsCopyProps } from "./types"

/** Copies `value` with Clipboard's states and announcements; its trigger is a Toolbar item. */
const { value, children, ...rest }: MessageActionsCopyProps = $props()
const ctx = messageActionsContext.get()
// A press re-reads a function value before Clipboard copies (the Trigger's own handler runs
// after this one, in the same task).
let reads = $state(0)
const text = $derived.by(() => {
  void reads
  return typeof value === "function" ? value() : value
})
</script>

<span {...attrs(mergeProps(normalizeProps(ctx.api().copy()), rest))}>
  <ClipboardRoot value={text} messages={{ copy: ctx.api().names.copy }}>
    {#snippet child({ props })}
      <span {...props}>
        <ToolbarItem focusableWhenDisabled>
          {#snippet child({ props: toolbar })}
            <ClipboardTrigger {...mergeProps(withoutScope(toolbar), { onclick: () => reads++ })}>{@render children?.()}</ClipboardTrigger>
          {/snippet}
        </ToolbarItem>
      </span>
    {/snippet}
  </ClipboardRoot>
</span>
