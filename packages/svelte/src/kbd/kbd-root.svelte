<script lang="ts">
import { kbdConnect, kbdMessages, parseKeys } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { usePlatform } from "./platform.svelte"
import type { KbdRenderState, KbdRootProps } from "./types"

const {
  keys,
  platform: ownPlatform,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: KbdRootProps = $props()

const uid = $props.id()
const messages = useMessages("kbd", kbdMessages, () => ownMessages)
const platform = usePlatform(() => ownPlatform)
const api = $derived(
  kbdConnect({
    instance: id ?? uid,
    chords: keys === undefined ? [] : parseKeys(keys),
    apple: platform.current === "apple",
    messages: messages(),
  }),
)
const hidden = $derived(normalizeProps(api.hiddenProps()))
const current: KbdRenderState = $derived({ platform: platform.current })
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#snippet content()}
  {#if keys === undefined}
    {@render children?.(current)}
  {:else}
    {#each api.items as it, i (i)}
      {#if it.type === "key"}
        <kbd {...attrs(normalizeProps(api.key(it.key)))}
          ><span {...attrs(normalizeProps(api.glyph(it.key)))}>{it.key.glyph}</span
          >{#if api.keyLabel(it.key) !== null}<span {...attrs(hidden)}>{api.keyLabel(it.key)}</span
            >{/if}</kbd
        >
      {:else}
        <span {...attrs(normalizeProps(api.separator(it.kind)))}
          ><span aria-hidden="true">{api.separatorText(it.kind)}</span><span {...attrs(hidden)}
            >{api.separatorSpoken(it.kind)}</span
          ></span
        >
      {/if}
    {/each}
  {/if}
{/snippet}

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the kbd element's attributes. -->
  <kbd {...merged as HTMLAttributes<HTMLElement>}>{@render content()}</kbd>
{/if}
