<script lang="ts">
import { atBottom, feedKeyAction, observeTop, stickToBottom, TABBABLE } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { articles, isNamed, messageThread } from "./context"
import { useFocusState } from "./focus-state.svelte"
import type { MessageThreadViewportProps } from "./types"

const { child, children, ...rest }: MessageThreadViewportProps = $props()
const ctx = messageThread.get()
const el = elementRef("div")
let content: HTMLElement | null = null
let sentinel: HTMLElement | null = null
let spacer: HTMLElement | null = null
const capture = (set: (node: HTMLElement | null) => void) => (node: HTMLElement) => {
  set(node)
  return () => set(null)
}
/** The user's turn the top layout keeps reachable at the viewport's top. */
let anchored: HTMLElement | null = null
/** Room below the anchored turn so it can sit at the top while the answer is short. */
const reserve = () => {
  const viewport = el.current as HTMLElement | null
  const room = spacer
  if (!viewport || !room) return
  if (!anchored?.isConnected) {
    room.style.blockSize = "0px"
    return
  }
  const below = room.getBoundingClientRect().top - anchored.getBoundingClientRect().top
  room.style.blockSize = `${Math.max(0, viewport.clientHeight - below)}px`
}
let fromBottom = 0
let firstMessage: Element | null = null
// A prepend (the first message changed, the old one still there): keep the reading place.
const keepPlace = () => {
  const viewport = el.current as HTMLElement | null
  if (!viewport) return
  const first = viewport.querySelector('[data-part="message"]')
  const before = firstMessage
  firstMessage = first
  if (before && first && before !== first && before.isConnected) {
    ctx.stick.current?.restore(fromBottom)
  }
  fromBottom = viewport.scrollHeight - viewport.scrollTop
}
$effect(() => {
  const viewport = el.current
  if (!(viewport instanceof HTMLElement)) return
  return untrack(() => {
    ctx.viewport.current = viewport
    const report = () => ctx.setAtBottom(atBottom(viewport, ctx.threshold()))
    const threshold = ctx.threshold()
    const controller = stickToBottom(viewport, content, {
      threshold,
      onUserScroll: (fact) => ctx.send({ type: "SCROLLED", ...fact }),
      onEscape: () => ctx.send({ type: "ESCAPE" }),
      following: () => ctx.state().state === "following" && ctx.state().anchor === "bottom",
      // The top layout never follows: growth that leaves the bottom is a fact to report.
      onResize: () => {
        reserve()
        report()
        if (ctx.state().state === "following" && !atBottom(viewport, threshold)) {
          ctx.send({ type: "SCROLLED", atBottom: false, up: false })
        }
      },
    })
    ctx.stick.current = controller
    ctx.turn.current = (b) => {
      const last = articles(viewport).at(-1)
      if (!last) return
      anchored = last
      reserve()
      controller.scrollChildToTop(last, b)
    }
    // Start at the bottom: a thread opens on its latest message.
    viewport.scrollTop = viewport.scrollHeight
    const onScroll = () => {
      fromBottom = viewport.scrollHeight - viewport.scrollTop
      report()
    }
    viewport.addEventListener("scroll", onScroll, { passive: true })
    report()
    keepPlace()
    const stopTop = sentinel
      ? observeTop(viewport, sentinel, () => {
          if (!ctx.loadingOlder()) ctx.loadOlder()
        })
      : undefined
    return () => {
      stopTop?.()
      viewport.removeEventListener("scroll", onScroll)
      controller.destroy()
      ctx.stick.current = null
      ctx.turn.current = null
    }
  })
})
// After each change of the thread (a prepend changes the count).
$effect(() => {
  ctx.api()
  untrack(keepPlace)
})

/** The first focusable element after (or before) `root` in document order. */
function focusableBeside(root: Element, after: boolean): HTMLElement | null {
  const all = Array.from(root.ownerDocument.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (node) => !root.contains(node) && node.tabIndex >= 0 && !(node as HTMLButtonElement).disabled,
  )
  const beside = all.filter((node) => {
    const pos = root.compareDocumentPosition(node)
    return after ? pos & Node.DOCUMENT_POSITION_FOLLOWING : pos & Node.DOCUMENT_POSITION_PRECEDING
  })
  return (after ? beside[0] : beside.at(-1)) ?? null
}
const ownsKeys = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.matches('input, textarea, select, [role="textbox"], [aria-keyshortcuts]')
  )
}
const focusState = useFocusState()
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().viewport(isNamed(rest), focusState.focus())), {
          ...focusState.handlers,
          onkeydown: (e: KeyboardEvent) => {
            const action = feedKeyAction({
              key: e.key,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              targetOwnsKeys: ownsKeys(e.target),
            })
            if (!action) return
            const viewport = e.currentTarget as HTMLElement
            if (action === "after" || action === "before") {
              const root = viewport.closest('[data-part="root"]') ?? viewport
              const target = focusableBeside(root, action === "after")
              if (!target) return
              e.preventDefault()
              target.focus()
              return
            }
            const list = articles(viewport)
            if (list.length === 0) return
            const active = (e.target as Element).closest('[data-part="message"]')
            const index = active ? list.indexOf(active as HTMLElement) : -1
            // From the viewport itself: the first message at least partly in view.
            const vr = viewport.getBoundingClientRect()
            const visible = list.findIndex((m) => m.getBoundingClientRect().bottom > vr.top)
            const from = index >= 0 ? index : Math.max(0, visible) - (action === "next" ? 1 : 0)
            const to = Math.min(list.length - 1, Math.max(0, from + (action === "next" ? 1 : -1)))
            const target = list[to]
            if (!target) return
            e.preventDefault()
            target.focus({ preventScroll: true })
            ctx.stick.current?.scrollChildIntoView(target)
          },
        }),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#snippet inner()}<div
    role="none"
    style="display: flow-root"
    {@attach capture((n) => {
      content = n
    })}
  ><div
      aria-hidden="true"
      style="block-size: 1px"
      {@attach capture((n) => {
        sentinel = n
      })}
    ></div>{@render children?.(ctx.state())}<div
      aria-hidden="true"
      data-reserve=""
      {@attach capture((n) => {
        spacer = n
      })}
    ></div></div
  >{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: inner }, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render inner()}</div>
{/if}
