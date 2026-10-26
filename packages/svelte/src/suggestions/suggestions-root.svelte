<script lang="ts">
import {
  announcerCapability,
  type SuggestionsSelectDetails,
  type SuggestionsState,
  suggestionsConnect,
  suggestionsMachine,
  suggestionsMessages,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { SvelteMap } from "svelte/reactivity"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { type SuggestionsEntry, suggestionsContext } from "./context"
import type { SuggestionsRenderState, SuggestionsRootProps } from "./types"

const {
  onSelect,
  loading = false,
  disabled = false,
  announce,
  focusTarget,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: SuggestionsRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability)
const messages = useMessages("suggestions", suggestionsMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const machine = useMachine(
  suggestionsMachine,
  () => ({
    loading,
    disabled,
    announce,
    onSelect: (d: SuggestionsSelectDetails) => onSelect?.(d),
    focusTarget: () => focusTarget?.() ?? null,
    messages: messages(),
    id: instance,
    lang: locale.current.locale,
  }),
  env,
)
const entries = new SvelteMap<string, SuggestionsEntry>()
/** DOM order: the items' indexes and the reported keys follow the rendered order. */
const ordered = $derived(
  [...entries.entries()].sort(([, a], [, b]) =>
    a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  ),
)
let rootEl: HTMLElement | undefined
const api = $derived(
  suggestionsConnect(
    {
      instance,
      state: machine.view.state as SuggestionsState,
      count: ordered.length,
      messages: messages(),
      named: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
    },
    env,
  ),
)
// The rendered keys, in order, once per change: items register one by one (on mount, and when
// a new set replaces the old one), so the report waits for the end of that microtask. The
// first report is then the whole first set, never announced.
let pending = false
$effect(() => {
  void ordered
  if (pending) return
  pending = true
  queueMicrotask(() => {
    pending = false
    machine.send({ type: "ITEMS", keys: ordered.map(([, e]) => e.key) })
  })
})
const suggestionsState: SuggestionsRenderState = $derived({
  state: machine.view.state as SuggestionsState,
  count: ordered.length,
})
suggestionsContext.set({
  api: () => api,
  state: () => suggestionsState,
  register: (itemId, entry) => {
    entries.set(itemId, entry)
    return () => entries.delete(itemId)
  },
  indexOf: (itemId) => ordered.findIndex(([k]) => k === itemId),
  press: (d) => machine.send({ type: "PRESS", ...d }),
  contains: (el) => el !== null && rootEl?.contains(el) === true,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
const capture = (node: HTMLElement) => {
  rootEl = node
}
</script>

{#if child}
  {@render child({ props: merged, state: suggestionsState })}
{:else}
  <div {...attrs(merged)} {@attach capture}>{@render children?.(suggestionsState)}</div>
{/if}
