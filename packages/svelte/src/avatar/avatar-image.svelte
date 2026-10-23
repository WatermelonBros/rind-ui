<script lang="ts">
import { checkImageAlt, checkImageCount } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLImgAttributes } from "svelte/elements"
import { useStatusImage } from "../image-status.svelte"
import { normalizeProps } from "../normalize-props"
import { avatarContext } from "./context"
import type { AvatarImageProps } from "./types"

const { child, ...rest }: AvatarImageProps = $props()
const ctx = avatarContext.get()
const image = useStatusImage(
  ctx.host,
  (has) => normalizeProps(ctx.api().image(has)),
  () => rest as Readonly<Record<string, unknown>>,
  checkImageCount,
)
$effect(() => checkImageAlt(rest.alt ?? undefined, ctx.name()))
const merged = $derived(stripMarker(image.props))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <!-- The part's props are img attributes (built from them). -->
  <img {...merged as HTMLImgAttributes} />
{/if}
