<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { fileUploadContext, fileUploadItem } from "./context"
import type { FileUploadItemPreviewProps } from "./types"

const { child, ...rest }: FileUploadItemPreviewProps = $props()
const ctx = fileUploadContext.get()
const item = fileUploadItem.get()
let url = $state<string | null>(null)
$effect(() => {
  const file = item.file()
  if (typeof File === "undefined" || !(file instanceof File) || !file.type.startsWith("image/")) {
    url = null
    return
  }
  const next = URL.createObjectURL(file)
  url = next
  // Revoked when the file changes or the preview unmounts.
  return () => URL.revokeObjectURL(next)
})
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().itemPreview()), { src: url }, rest)),
)
</script>

{#if url}
  {#if child}
    {@render child({ props: merged, state: ctx.state() })}
  {:else}
    <img {...attrs(merged)} alt={(merged["alt"] as string | undefined) ?? ""} />
  {/if}
{/if}
