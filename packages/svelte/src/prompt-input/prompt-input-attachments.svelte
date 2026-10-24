<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { promptInput } from "./context"
import Attachment from "./prompt-input-attachment.svelte"
import AttachmentName from "./prompt-input-attachment-name.svelte"
import AttachmentRemove from "./prompt-input-attachment-remove.svelte"
import ChipScope from "./prompt-input-chip-scope.svelte"
import type { PromptInputAttachmentsProps } from "./types"

/** The attachments toolbar: one Attachment per file. Renders nothing while empty. */
const { child, children, ...rest }: PromptInputAttachmentsProps = $props()
const host = promptInput.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().chipsPart()), rest)))
</script>

{#snippet chips()}{#each host.attachments() as attachment (attachment.id)}<ChipScope {attachment}
      >{#if children}{@render children(attachment)}{:else}<Attachment
          ><AttachmentName /><AttachmentRemove /></Attachment
        >{/if}</ChipScope
    >{/each}{/snippet}

{#if host.attachments().length > 0}
  {#if child}
    {@render child({ props: { ...merged, children: chips }, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render chips()}</div>
  {/if}
{/if}
