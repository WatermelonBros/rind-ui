<script lang="ts">
import type { PaginationDirection, PaginationState } from "@rind-ui/core"
import { elementRef } from "../element-ref.svelte"
import { normalizeProps } from "../normalize-props"
import { paginationContext } from "./context"
import Control from "./control.svelte"
import type { PaginationControlProps } from "./types"

const {
  direction,
  focusableWhenDisabled,
  child,
  children,
  ...rest
}: PaginationControlProps & { readonly direction: PaginationDirection } = $props()
const CHEVRON: Record<PaginationDirection, string> = {
  first: "M11 4 7 8l4 4M6 4v8",
  previous: "M10 4 6 8l4 4",
  next: "m6 4 4 4-4 4",
  last: "m5 4 4 4-4 4M10 4v8",
}
const EVENT = { first: "FIRST", previous: "PREV", next: "NEXT", last: "LAST" } as const
const TARGET: Record<PaginationDirection, (s: PaginationState) => number> = {
  first: () => 1,
  previous: (s) => Math.max(1, s.page - 1),
  next: (s) => Math.min(s.totalPages, s.page + 1),
  last: (s) => s.totalPages,
}
const ctx = paginationContext.get()
const el = elementRef("button")
const labelled = $derived(rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined)
// ponytail: snippet children are measured after mount (Svelte cannot read a snippet's text
// while rendering): a text-only trigger keeps the message name in the server HTML.
const hasText = $derived(children !== undefined && (el.current?.textContent?.trim() ?? "") !== "")
const c = $derived(ctx.api().trigger(direction, labelled || hasText))
const s = $derived(ctx.state())
</script>

{#snippet content()}{#if children}{@render children({ disabled: c.disabled, pending: false, pressed: false, hovered: false, focusVisible: false })}{:else}<svg aria-hidden="true" viewBox="0 0 16 16" width="1em" height="1em" data-direction={direction}><path d={CHEVRON[direction]} fill="none" stroke="currentColor" stroke-width="1.5" /></svg>{/if}{/snippet}

<Control
  own={{ ...normalizeProps(c.props), ...el.props }}
  {rest}
  disabled={c.disabled}
  current={false}
  href={c.disabled ? undefined : ctx.getPageHref()?.(TARGET[direction](s), s.pageSize)}
  {focusableWhenDisabled}
  onActivate={(modality) => ctx.send({ type: EVENT[direction], modality })}
  {child}
  {content}
/>
