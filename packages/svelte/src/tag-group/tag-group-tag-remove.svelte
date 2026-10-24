<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { DEV } from "../dev"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { tagGroupHost, tagGroupTag } from "./context"
import type { TagGroupTagRemoveProps } from "./types"

const { child, children, ...rest }: TagGroupTagRemoveProps = $props()
const host = tagGroupHost.get()
const tag = tagGroupTag.maybe() ?? null
if (!tag && DEV) console.warn("[rind-ui] TagGroup: TagRemove is outside a Tag; it renders nothing.")
const own = $derived(tag ? host.parts().itemRemove(tag.key()) : null)
const merged = $derived(
  own
    ? stripMarker(
        mergeProps(
          {
            ...normalizeProps(own),
            // The press focuses the tag (connect prevents the button's own focus).
            onpointerdown: (e: PointerEvent) => {
              ;(own["onPointerDown"] as ((e: unknown) => void) | undefined)?.(e)
              if (!e.defaultPrevented || (own["disabled"] as boolean | undefined)) return
              const row = tag?.row.current
              if (row instanceof HTMLElement) row.focus({ preventScroll: true })
            },
          },
          rest,
        ),
      )
    : {},
)
</script>

{#if tag && host.removable()}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <button {...merged as HTMLButtonAttributes}
      >{#if children}{@render children()}{:else}<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="1em" height="1em"
          ><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
        >{/if}</button
    >
  {/if}
{/if}
