<script lang="ts">
import {
  announcerCapability,
  type ChangeDetails,
  type CollectionKey,
  caretRect,
  createListCollection,
  domPositioning,
  isEmptyState,
  layoutCapability,
  type MentionRange,
  type MentionsEvent,
  type MentionsQuery,
  type MentionsSelectDetails,
  mentionsConnect,
  mentionsIds,
  mentionsMachine,
  mentionsMessages,
  patternResults,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { popupHost } from "../combobox/context"
import { listboxHost } from "../listbox/context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { useCollectionItems } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { mentionsHost } from "./context"
import type { MentionsRenderState, MentionsRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  mentions = $bindable(),
  defaultMentions,
  onMentionsChange,
  triggers,
  items,
  filter,
  onQueryChange,
  onSelect,
  formatLabel,
  selectOnTab = true,
  loading,
  readonly: readOnly = false,
  disabled = false,
  positioning,
  keepMounted = false,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: MentionsRootProps = $props()

const EMPTY = createListCollection({ items: [] as string[], getKey: (s) => s, getText: (s) => s })

const uid = $props.id()
const instance = $derived(id ?? uid)
const base = useEnvironment(announcerCapability, layoutCapability)
const messages = useMessages("mentions", mentionsMessages, () => ownMessages)
const textarea: { current: HTMLTextAreaElement | null } = { current: null }
const highlighter: { current: HTMLElement | null } = { current: null }
// The caret the machine asked for: placed after the value it wrote is rendered.
let caret: number | null = null
const placeCaret = () => {
  const el = textarea.current
  if (!el || caret === null) return
  const c = caret
  caret = null
  el.setSelectionRange(c, c)
}
const env = {
  ...base,
  position: domPositioning(base),
  setCaret: (c: number) => {
    caret = c
    // After Svelte's flush has written the value (a microtask after the event).
    queueMicrotask(() => queueMicrotask(placeCaret))
  },
}
const registered = useCollectionItems()
let query = $state<MentionsQuery | null>(null)
const results = $derived(
  items
    ? items
    : patternResults(
        registered.collection ?? EMPTY,
        query?.query ?? "",
        filter,
        base.locale.locale(),
      ),
)
const ids = untrack(() => mentionsIds(instance))
let svc: { view(): { context: { match: { start: number } | null } } } | null = null
const machine = useMachine(
  mentionsMachine,
  () => ({
    root: instance,
    ids,
    strategy: "active-descendant" as const,
    collection: results,
    loading,
    positioning,
    messages: messages(),
    triggers,
    value,
    defaultValue,
    onValueChange: (v: string, d: ChangeDetails<MentionsEvent>) => {
      onValueChange?.(v, d)
      if (value !== undefined) value = v
    },
    mentions,
    defaultMentions,
    onMentionsChange: (m: readonly MentionRange[], d: ChangeDetails<MentionsEvent>) => {
      onMentionsChange?.(m, d)
      if (mentions !== undefined) mentions = m
    },
    onQueryChange: (q: MentionsQuery | null) => {
      query = q
      onQueryChange?.(q)
    },
    onSelect: (d: MentionsSelectDetails) => onSelect?.(d),
    formatLabel,
    selectOnTab,
    readOnly,
    disabled,
    anchor: () => {
      const el = textarea.current
      const m = svc?.view().context.match
      if (!el || !m) return null
      const r = caretRect(el, m.start)
      return {
        getBoundingClientRect: () => ({
          x: r.left,
          y: r.top,
          left: r.left,
          top: r.top,
          width: 0,
          height: r.height,
          right: r.left,
          bottom: r.top + r.height,
        }),
      }
    },
  }),
  env,
)
svc = machine.service
// Known after mount: the server render and hydration never carry `popover`.
let topLayer = $state(false)
$effect(() => {
  topLayer = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype
})
let mounted = $state.raw<{
  label: boolean
  empty: boolean
  descriptions: ReadonlySet<CollectionKey>
}>({ label: false, empty: false, descriptions: new Set() })
const view = $derived(machine.view)
const open = $derived(view.matches("open"))
const modality = useModality(base.modality, () => view.context.focused)
const exposure = $derived({ open, results, query: view.context.match?.query ?? "", loading })
const api = $derived(
  mentionsConnect(
    {
      instance,
      open,
      empty: isEmptyState(exposure),
      results,
      context: view.context,
      disabled,
      loading,
      modality: modality.current,
      dir: base.locale.dir(),
      mounted: {
        label: mounted.label,
        empty: mounted.empty,
        description: (key) => mounted.descriptions.has(key),
      },
      topLayer,
      blur: () => machine.send({ type: "INPUT.BLUR" }),
      value: view.values.value ?? "",
      mentions: view.values.mentions ?? [],
      match: view.context.match,
      triggers: triggers.map((t) => t.char),
      readOnly,
      composing: view.context.composing,
      messages: messages(),
      send: machine.send,
    },
    env,
  ),
)
const mentionsState: MentionsRenderState = $derived({
  open,
  trigger: view.context.match?.trigger ?? null,
  query: view.context.match?.query ?? "",
})
mentionsHost.set({
  api: () => api,
  state: () => mentionsState,
  send: machine.send,
  open: () => open,
  highlightedKey: () => view.context.highlightedKey,
  selectOnTab: () => selectOnTab,
  textarea,
  highlighter,
})
const mount = (part: "label" | "empty", on: boolean) =>
  untrack(() => {
    if (mounted[part] !== on) mounted = { ...mounted, [part]: on }
  })
popupHost.set({
  name: "Mentions",
  api: () => api,
  open: () => open,
  keepMounted: () => keepMounted,
  // The list's presence is the machine's open state (connect needs no presence of its own).
  setPresent: () => {},
  topLayer: () => topLayer,
  inline: false,
})
listboxHost.set({
  name: "Mentions",
  // Sound: the mentions api has every listbox part the shared parts call.
  parts: () => ({ ...api, isEmpty: isEmptyState(exposure) }) as never,
  collection: () => results,
  registry: untrack(() => (items ? null : registered.registry)),
  listed: (key) => results.has(key),
  mount,
  mountDescription: (key, on) =>
    untrack(() => {
      if (mounted.descriptions.has(key) === on) return
      const next = new Set(mounted.descriptions)
      if (on) next.add(key)
      else next.delete(key)
      mounted = { ...mounted, descriptions: next }
    }),
  requestLoadMore: () => {},
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: mentionsState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(mentionsState)}</div>
{/if}
