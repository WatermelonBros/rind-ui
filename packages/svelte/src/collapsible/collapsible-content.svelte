<script lang="ts">
import { contentSize, partId, untilFound } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import HeadingLevel from "../heading/heading-level.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterPart, useRenderedId } from "../use-ids.svelte"
import { usePresence } from "../use-presence.svelte"
import { collapsibleContext, stateOf, useApi } from "./service.svelte"
import type { CollapsibleContentProps } from "./types"

const { id, child, children, ...rest }: CollapsibleContentProps = $props()
const ctx = collapsibleContext.get()
const env = useEnvironment()
const open = $derived(ctx.view().matches("open"))
const el = elementRef("div")
$effect(() => {
  ctx.contentEl.current = el.current
})
const presence = usePresence(
  () => open,
  () => el.current,
)
// Closed with nothing animating (reduced motion, jsdom, no theme): hidden in the closing step
// itself, not after presence's asynchronous wait (base-ui#4553).
let quickExit = $state(false)
$effect.pre(() => {
  if (open) untrack(() => (quickExit = false))
})
const exited = $derived(presence.state === "absent" || quickExit)
const mounted = $derived(ctx.closedContent() !== "unmount" || open || !exited)
// A consumer id is the id the trigger references (aria-controls).
const own = $derived(id ?? partId(ctx.scope, ctx.idBase(), "content"))
useRegisterPart(ctx.registry, "content", () => (mounted ? own : undefined))
const findable = $derived(ctx.closedContent() === "until-found" && !ctx.disabled())
let size: { node: Element; s: ReturnType<typeof contentSize> } | null = null
// The open value of the last update that ran the size sequence (undefined: none yet).
let sized: boolean | undefined
// Defined from the first paint, the server's included (zag#1396); the same value on every
// update, so the imperative writes below are never overwritten.
const initialSize = untrack(() => (open ? "auto" : "0px"))
// Size properties: 0px → px → auto → px → 0px, only after an update that changed `open`.
$effect(() => {
  const isOpen = open
  const node = el.current
  return untrack(() => {
    const initial = sized === undefined
    if (sized === isOpen) return
    sized = isOpen
    if (!(node instanceof HTMLElement)) return
    // A remounted content (unmount mode) is a new element.
    if (size?.node !== node) size = { node, s: contentSize(node, `rind-${ctx.scope}`) }
    const s = size.s
    if (isOpen) {
      const instant = initial || ctx.view().context.reveal === "find-in-page"
      s.opened({ instant })
      if (instant) return
      // Settled once the enter animations finished (or at once when nothing animates).
      const running = node.getAnimations?.({ subtree: true }) ?? []
      let live = true
      void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(() => {
        if (live) s.settled()
      })
      return () => {
        live = false
      }
    }
    if (initial) return
    s.closed()
    if ((node.getAnimations?.({ subtree: true }) ?? []).length === 0) quickExit = true
    return undefined
  })
})
// until-found: imperatively; beforematch opens instantly.
let finder: ReturnType<typeof untilFound> | null = null
$effect(() => {
  const node = el.current
  if (!findable || !(node instanceof HTMLElement)) return
  return untrack(() => {
    const h = untilFound(node, {
      scheduler: env.scheduler,
      isOpen: () => open || !exited,
      onReveal: () => {
        ctx.send({ type: "OPEN", reason: "find-in-page" })
        // Full size in the same task, before the browser highlights the match (base-ui#5513).
        size?.s.opened({ instant: true })
      },
    })
    finder = h
    return () => {
      h.dispose()
      finder = null
      // No longer findable (disabled): the rendered `hidden` did not change, so degrade it here.
      if (node.getAttribute("hidden") === "until-found") node.setAttribute("hidden", "")
    }
  })
})
// Re-applied after every update of what it reads.
$effect(() => {
  void open
  void exited
  untrack(() => finder?.sync())
  // Development: a stylesheet hiding [hidden] defeats find-in-page (react-spectrum#7160).
  const node = el.current
  if (!DEV || !(node instanceof HTMLElement) || !findable || open) return
  if (node.getAttribute("hidden") === "until-found" && getComputedStyle(node).display === "none") {
    console.warn(
      `[rind-ui] ${ctx.scope}: the closed content computes display: none, so find-in-page cannot reveal it (a stylesheet sets [hidden] { display: none }?)`,
    )
  }
})
const apiFor = useApi(ctx)
const triggerRendered = useRenderedId(ctx.registry, "trigger")
const merged = $derived.by(() => {
  const triggerId =
    triggerRendered.current ?? ctx.triggerId.current ?? partId(ctx.scope, ctx.idBase(), "trigger")
  // Closed and settled: hidden (server HTML carries hidden=""), upgraded to until-found
  // right after mount by the until-found module (hidden-content).
  const hidden = !open && exited
  return stripMarker(
    mergeProps(
      {
        ...normalizeProps({
          ...apiFor().content(hidden),
          ...ctx.decoration.content?.(triggerId),
          style: {
            [`--rind-${ctx.scope}-content-height`]: initialSize,
            [`--rind-${ctx.scope}-content-width`]: initialSize,
          },
        }),
        ...el.props,
      },
      rest,
    ),
  )
})
const current = $derived(stateOf(ctx))
const level = $derived(ctx.decoration.contentLevel?.())
</script>

{#snippet body()}
  {#if level === undefined}
    {@render children?.(current)}
  {:else}
    <!-- A heading inside an Accordion panel is one level below its header. -->
    <HeadingLevel {level}>{@render children?.(current)}</HeadingLevel>
  {/if}
{/snippet}

{#if mounted}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <div {...attrs(merged)}>{@render body()}</div>
  {/if}
{/if}
