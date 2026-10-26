<script lang="ts">
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import ToggleGroupRoot from "../toggle-group/toggle-group-root.svelte"
import { messageActionsContext } from "./context"
import type { MessageActionsFeedbackProps } from "./types"

/** Thumbs up/down: a single, deselectable Toggle Group named `messages.feedback`. */
const feedbackProps: MessageActionsFeedbackProps = $props()
const ctx = messageActionsContext.get()
const merged = $derived(
  mergeProps(normalizeProps(ctx.api().feedback()), feedbackProps) as MessageActionsFeedbackProps,
)
</script>

<ToggleGroupRoot aria-label={ctx.api().names.feedback} {...merged} selectionMode="single" />
