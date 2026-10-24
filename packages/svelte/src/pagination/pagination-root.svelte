<script lang="ts">
import {
  type PaginationChangeDetails,
  paginationConnect,
  paginationMachine,
  paginationMessages,
  paginationState,
  warnControlledWithoutHandler,
  warnDuplicateLandmark,
  warnPaginationInputs,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { paginationContext } from "./context"
import type { PaginationRootProps, PaginationRootState } from "./types"

let {
  totalPages,
  count,
  page = $bindable(),
  defaultPage,
  onPageChange,
  pageSize = $bindable(),
  defaultPageSize,
  onPageSizeChange,
  siblingCount,
  boundaryCount,
  disabled = false,
  focusableWhenDisabled = true,
  getPageHref,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: PaginationRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("pagination", paginationMessages, () => ownMessages)
/** A change event: the consumer's handler first, then the binding unless it cancelled. */
const changer =
  (
    handler: () => ((v: number, d: PaginationChangeDetails) => void) | undefined,
    write: (v: number) => void,
  ) =>
  (next: number, details: PaginationChangeDetails) => {
    let cancelled = false
    handler()?.(next, {
      ...details,
      cancel: () => {
        cancelled = true
        details.cancel()
      },
    })
    if (!cancelled) write(next)
  }
const machineProps = () => ({
  totalPages,
  count,
  page,
  defaultPage,
  onPageChange: changer(
    () => onPageChange,
    (v) => {
      if (page !== undefined) page = v
    },
  ),
  pageSize,
  defaultPageSize,
  onPageSizeChange: changer(
    () => onPageSizeChange,
    (v) => {
      if (pageSize !== undefined) pageSize = v
    },
  ),
  siblingCount,
  boundaryCount,
  disabled,
})
const machine = useMachine(paginationMachine, machineProps)
const base = $derived(paginationState(machineProps(), machine.view.values))
const api = $derived(
  paginationConnect({
    instance,
    state: base,
    messages: messages(),
    disabled,
    siblingCount,
    boundaryCount,
  }),
)
const current: PaginationRootState = $derived({
  ...base,
  pages: api.pages(),
  setPage: (n: number) => machine.send({ type: "SET_PAGE", page: n, modality: "virtual" }),
  setPageSize: (n: number) => machine.send({ type: "SET_PAGE_SIZE", pageSize: n }),
})
const el = elementRef("nav")
$effect(() => {
  const input = { totalPages, count, pageSize, siblingCount, boundaryCount }
  untrack(() => warnPaginationInputs(input))
})
$effect(() => {
  const controlled = [page !== undefined, pageSize !== undefined]
  const handled = [onPageChange !== undefined, onPageSizeChange !== undefined]
  untrack(() => {
    warnControlledWithoutHandler("page", controlled[0] === true, handled[0] === true)
    warnControlledWithoutHandler("pageSize", controlled[1] === true, handled[1] === true)
  })
})
const labelled = $derived(rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined)
$effect(() => {
  void [rest["aria-label"], rest["aria-labelledby"]]
  const node = el.current
  if (node instanceof HTMLElement) untrack(() => warnDuplicateLandmark(node))
})
paginationContext.set({
  api: () => api,
  state: () => current,
  send: machine.send,
  getPageHref: () => getPageHref,
  focusableWhenDisabled: () => focusableWhenDisabled,
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(api.root(labelled)), ...el.props }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <nav {...attrs(merged)}>{@render children?.(current)}</nav>
{/if}
