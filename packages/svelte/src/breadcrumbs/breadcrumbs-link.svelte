<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import Link from "../link/link.svelte"
import type { LinkState } from "../link/types"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { breadcrumbsContext, breadcrumbsItem } from "./context"
import type { BreadcrumbsLinkProps } from "./types"

const { href, routerOptions, child, children, ...rest }: BreadcrumbsLinkProps = $props()
const root = breadcrumbsContext.get()
const item = breadcrumbsItem.get()
const el = elementRef("a")
$effect(() => {
  const meta = { href, routerOptions, text: el.current?.textContent?.trim() ?? "" }
  untrack(() => item.reportLink(meta))
})
const itemState = $derived(item.state())
const asText = $derived(itemState.current && href === undefined)
// A focused link that becomes the current text is a new element (an <a> becomes a <span>):
// read the focus while the old element is still in the document, and give it back after
// the update (react-spectrum#2592, #5294).
let hadFocus = false
let wasText = untrack(() => asText)
$effect.pre(() => {
  void asText
  const node = untrack(() => el.current)
  hadFocus = node !== null && node === node.ownerDocument.activeElement
})
$effect(() => {
  const now = asText
  const node = el.current
  untrack(() => {
    if (wasText !== now && hadFocus && node instanceof HTMLElement) node.focus()
    wasText = now
  })
})
const textProps = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(root.connect().currentText(itemState)), ...el.props }, rest),
  ),
)
const linkState: LinkState = $derived({
  disabled: itemState.disabled,
  current: true,
  pressed: false,
  hovered: false,
  focusVisible: false,
})
</script>

{#if asText}
  {#if child}
    {@render child({ props: textProps, state: linkState })}
  {:else}
    <span {...attrs(textProps)}>{@render children?.(linkState)}</span>
  {/if}
{:else}
  <Link
    {...rest}
    {...el.props}
    {...href === undefined ? {} : { href }}
    {...routerOptions === undefined ? {} : { routerOptions }}
    disabled={itemState.disabled}
    {...itemState.current ? { current: itemState.currentValue } : {}}
    data-scope="breadcrumbs"
    data-part="link"
    data-instance={root.instance()}
    {child}
    {children}
  />
{/if}
