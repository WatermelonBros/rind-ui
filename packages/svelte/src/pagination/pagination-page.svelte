<script lang="ts">
import { normalizeProps } from "../normalize-props"
import { paginationContext } from "./context"
import Control from "./control.svelte"
import type { PaginationPageProps } from "./types"

const { value, focusableWhenDisabled, child, children, ...rest }: PaginationPageProps = $props()
const ctx = paginationContext.get()
const labelled = $derived(rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined)
const c = $derived(ctx.api().page(value, labelled))
const s = $derived(ctx.state())
</script>

{#snippet content()}{#if children}{@render children({ disabled: c.disabled, pending: false, pressed: false, hovered: false, focusVisible: false })}{:else}{value}{/if}{/snippet}

<Control
  own={normalizeProps(c.props)}
  {rest}
  disabled={c.disabled}
  current={value === s.page}
  href={ctx.getPageHref()?.(value, s.pageSize)}
  {focusableWhenDisabled}
  onActivate={(modality) => ctx.send({ type: "SET_PAGE", page: value, modality })}
  {child}
  {content}
/>
