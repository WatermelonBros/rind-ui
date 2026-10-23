<script lang="ts">
import {
  type ChangeDetails,
  partId,
  readingPosition,
  type TableOfContentsChangeReason,
  type TableOfContentsEvent,
  tableOfContentsConnect,
  tableOfContentsMachine,
  tableOfContentsMessages,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { type Marker, tocContext } from "./context"
import type { TableOfContentsRenderState, TableOfContentsRootProps } from "./types"

let {
  items,
  value = $bindable(),
  defaultValue,
  onValueChange,
  scrollRoot,
  offset,
  ratio,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: TableOfContentsRootProps = $props()

const env = useEnvironment()
const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("table-of-contents", tableOfContentsMessages, () => ownMessages)
let titled = $state(false)
let marker = $state.raw<Marker>(null)
const machine = useMachine(
  tableOfContentsMachine,
  () => ({
    id: instance,
    value,
    defaultValue,
    onValueChange: (next: string, d: ChangeDetails<TableOfContentsEvent>) => {
      // Sound: every value-writing transition declares one of these reasons (machine).
      onValueChange?.(next, {
        reason: d.reason as unknown as TableOfContentsChangeReason,
        event: d.event,
      })
      if (value !== undefined) value = next
    },
  }),
  env,
)
$effect(() => {
  const root = scrollRoot ?? null
  const o = offset
  const r = ratio
  return untrack(() =>
    readingPosition(document, {
      ids: () => items.map((i) => i.id),
      scrollRoot: root,
      offset: o,
      ratio: r,
      onPosition: (p) => machine.send({ type: "POSITION", current: p.current, visible: p.visible }),
      onUserScroll: () => machine.send({ type: "USER.SCROLL" }),
    }),
  )
})
const api = $derived(
  tableOfContentsConnect({
    instance,
    value: machine.view.values.value,
    visible: machine.view.context.visible,
    titled,
    ids: { title: partId("table-of-contents", instance, "title") },
    marker,
    messages: messages(),
  }),
)
const tocState: TableOfContentsRenderState = $derived({ value: machine.view.values.value })
const navigate = (target: string) => {
  // The activation's modality, read now: the focus moves after the browser's jump.
  const modality = env.modality.modality()
  machine.send({ type: "NAVIGATE", id: target })
  if (modality !== "keyboard" && modality !== "virtual") return
  env.scheduler.requestAnimationFrame(() => {
    const heading = document.getElementById(target)
    if (!heading) return
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1")
    env.modality.markFocus(heading, "navigation", modality)
    // No scroll: the jump already placed the heading (and may still be scrolling smoothly).
    heading.focus({ preventScroll: true })
  })
}
tocContext.set({
  api: () => api,
  state: () => tocState,
  navigate,
  setTitled: (on) => {
    titled = on
  },
  setMarker: (m) => {
    const prev = untrack(() => marker)
    if (prev?.top !== m?.top || prev?.height !== m?.height) marker = m
  },
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: tocState })}
{:else}
  <nav {...attrs(merged)}>{@render children?.(tocState)}</nav>
{/if}
