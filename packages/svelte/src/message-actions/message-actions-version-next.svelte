<script lang="ts">
import Button from "./message-actions-button.svelte"
import type { MessageActionsButtonProps } from "./types"

const buttonProps: MessageActionsButtonProps = $props()
</script>

<Button kind="versionNext" {...buttonProps} />
