<script lang="ts">
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import ToolbarItem from "../toolbar/toolbar-item.svelte"
import { messageActionsContext } from "./context"
import type { MessageActionsItemProps } from "./types"

/** Your own action: a Toolbar item. */
const itemProps: MessageActionsItemProps = $props()
const ctx = messageActionsContext.get()
// Sound: the consumer's Toolbar.Item props, with this part's data-* first.
const merged = $derived(
  mergeProps(normalizeProps(ctx.api().item()), itemProps) as MessageActionsItemProps,
)
</script>

<ToolbarItem {...merged} />
