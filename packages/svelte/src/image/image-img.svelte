<script lang="ts">
import { checkImgCount } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLImgAttributes } from "svelte/elements"
import { useStatusImage } from "../image-status.svelte"
import { normalizeProps } from "../normalize-props"
import { imageContext } from "./context"
import type { ImageImgProps } from "./types"

const { child, ...rest }: ImageImgProps = $props()
const ctx = imageContext.get()
const image = useStatusImage(
  ctx.host,
  (has) => normalizeProps(ctx.api().img(has)),
  () => rest as Readonly<Record<string, unknown>>,
  checkImgCount,
)
const merged = $derived(stripMarker(image.props))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <!-- The part's props are img attributes, `alt` included (Root's). -->
  <img {...merged as HTMLImgAttributes} />
{/if}
