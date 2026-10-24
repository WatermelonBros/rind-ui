<script lang="ts">
import type { PromptAttachment } from "@rind-ui/core"
import type { Snippet } from "svelte"
import { promptChip } from "./context"

// Provides one attachment to the chip parts inside it.
const { attachment, children }: { attachment: PromptAttachment; children: Snippet } = $props()
promptChip.set(() => ({ key: attachment.id, attachment }))
</script>

{@render children()}
