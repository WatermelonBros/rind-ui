<script lang="ts">
import { avatarGroupOverflowProps, avatarMessages } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import VisuallyHidden from "../visually-hidden.svelte"
import type { AvatarGroupOverflowProps } from "./types"

const { count, messages: ownMessages, id, child, ...rest }: AvatarGroupOverflowProps = $props()
const uid = $props.id()
const messages = useMessages("avatar", avatarMessages, () => ownMessages)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(avatarGroupOverflowProps(id ?? uid)),
        ...(id === undefined ? {} : { id }),
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: { count } })}
{:else}
  <span {...attrs(merged)}
    ><span aria-hidden="true">+{count}</span><VisuallyHidden
      >{messages().overflowLabel(count)}</VisuallyHidden
    ></span
  >
{/if}
