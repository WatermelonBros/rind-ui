<script lang="ts">
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import ToggleGroupItem from "../toggle-group/toggle-group-item.svelte"
import { messageActionsContext } from "./context"
import type { MessageActionsFeedbackItemProps } from "./types"

/** `value="up"` or `"down"`, named "Good response" / "Bad response". */
const { value, children, ...rest }: MessageActionsFeedbackItemProps = $props()
const ctx = messageActionsContext.get()
const merged = $derived(
  mergeProps(
    { "aria-label": value === "up" ? ctx.api().names.up : ctx.api().names.down },
    normalizeProps(ctx.api().feedbackItem(value)),
    rest,
  ),
)
</script>

<ToggleGroupItem {...merged} {value}>{@render children?.()}</ToggleGroupItem>
