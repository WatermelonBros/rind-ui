<script lang="ts">
// A Button, or a Link when the Root has `getPageHref` (spec "Buttons And Links").
import type { LinkInput, Modality } from "@rind-ui/core"
import type { Snippet } from "svelte"
import Button from "../button/button.svelte"
import type { ButtonState } from "../button/types"
import type { ChildArgs } from "../child"
import Link from "../link/link.svelte"
import { mergeProps } from "../merge-props"
import { paginationContext } from "./context"

const {
  own,
  rest,
  disabled,
  href,
  current,
  focusableWhenDisabled,
  onActivate,
  child,
  content,
}: {
  own: Record<string | symbol, unknown>
  rest: Record<string | symbol, unknown>
  disabled: boolean
  href: string | undefined
  current: boolean
  focusableWhenDisabled: boolean | undefined
  onActivate: (modality: Modality) => void
  child: Snippet<[ChildArgs<ButtonState>]> | undefined
  content: Snippet
} = $props()
const ctx = paginationContext.get()
const merged = $derived(mergeProps(own, rest))
const keepsFocus = $derived(focusableWhenDisabled ?? ctx.focusableWhenDisabled())
// Same-tab activations only: a ⌘/Ctrl/middle click opens elsewhere and the page stays.
const onLinkActivate: LinkInput["onActivate"] = (a) => {
  if (a.disposition === "same-tab") onActivate(a.modality)
}
</script>

{#if ctx.getPageHref() !== undefined}
  <Link
    {...merged}
    {...href === undefined ? {} : { href }}
    {...current ? { current: "page" as const } : {}}
    {disabled}
    focusableWhenDisabled={keepsFocus}
    onActivate={onLinkActivate}
    child={child as never}
  >{@render content()}</Link>
{:else}
  <Button
    {...merged}
    {disabled}
    focusableWhenDisabled={keepsFocus}
    onPress={(d) => onActivate(d.modality)}
    {child}
  >{@render content()}</Button>
{/if}
