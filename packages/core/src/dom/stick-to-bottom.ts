// stick-to-bottom (add-message-thread design §3): the DOM side of a thread that follows its
// newest content. It tells the user's scrolls from its own (a remembered target and
// direction), escapes on an upward wheel or a dragged selection, keeps the bottom through
// content growth and viewport shrink, keeps the reading position through prepends, and
// reports reaching the top. It writes `scrollTop` on the viewport only, never
// `scrollIntoView` (that scrolls the page too).

export type StickBehavior = "smooth" | "instant"

/** Within `threshold` px of the bottom: a tolerance, never equality (Safari zoom). */
export function atBottom(el: Element, threshold: number): boolean {
  return el.scrollHeight - el.clientHeight - el.scrollTop <= threshold
}

export interface StickOptions {
  readonly threshold: number
  /** A scroll the user made: where it ended and which way it went. */
  readonly onUserScroll: (fact: { readonly atBottom: boolean; readonly up: boolean }) => void
  /** An upward wheel on the viewport, or a text selection dragged inside it. */
  readonly onEscape: () => void
  /** Follow growth now (the thread is following, bottom layout). */
  readonly following: () => boolean
  /** The content grew or the viewport resized while not following (top layout reports). */
  readonly onResize?: (() => void) | undefined
}

export interface StickController {
  scrollToBottom(behavior: StickBehavior): void
  /** Scrolls `child`'s top to the viewport's top. */
  scrollChildToTop(child: Element, behavior: StickBehavior): void
  /** Brings `child` into the viewport with the least scroll. */
  scrollChildIntoView(child: Element): void
  /** Before a prepend: the distance from the bottom, restored by `restore`. */
  snapshot(): number
  restore(fromBottom: number): void
  destroy(): void
}

export function stickToBottom(
  el: HTMLElement,
  content: Element | null,
  options: StickOptions,
): StickController {
  const win = el.ownerDocument.defaultView
  let last = el.scrollTop
  /** The component's own scroll in flight: events moving toward `to` are not the user's. */
  let own: { readonly to: number } | null = null
  let selecting = false

  const scrollTo = (top: number, behavior: StickBehavior) => {
    const max = Math.max(0, el.scrollHeight - el.clientHeight)
    const to = Math.min(max, Math.max(0, top))
    if (Math.abs(el.scrollTop - to) <= 1) return
    own = { to }
    if (behavior === "smooth" && typeof el.scrollTo === "function") {
      el.scrollTo({ top: to, behavior: "smooth" })
    } else {
      el.scrollTop = to
    }
  }

  const onScroll = () => {
    const top = el.scrollTop
    const up = top < last
    last = top
    if (own) {
      const towards = own.to > top ? !up : own.to < top ? up : true
      if (Math.abs(top - own.to) <= 1) {
        own = null
        return
      }
      // Still travelling toward the target: ours. Against it: the user took over.
      if (towards) return
      own = null
    }
    options.onUserScroll({ atBottom: atBottom(el, options.threshold), up })
  }

  const onWheel = (e: WheelEvent) => {
    if (e.deltaY >= 0 || el.scrollHeight <= el.clientHeight) return
    // The browser cancels a wheel scroll that fights an animation: escape at once.
    own = null
    options.onEscape()
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 0) selecting = true
  }
  const onPointerUp = () => {
    selecting = false
  }
  const onSelection = () => {
    if (!selecting) return
    const sel = el.ownerDocument.getSelection()
    if (sel && !sel.isCollapsed && sel.anchorNode && el.contains(sel.anchorNode)) {
      // The view must not move under a dragged selection.
      options.onEscape()
    }
  }

  const follow = () => {
    if (options.following()) {
      // Growth is tracked, not animated: instant keeps the newest line in view.
      scrollTo(el.scrollHeight, "instant")
    } else {
      options.onResize?.()
    }
  }
  const ro = typeof win?.ResizeObserver === "function" ? new win.ResizeObserver(follow) : null
  ro?.observe(el)
  if (content) ro?.observe(content)

  el.addEventListener("scroll", onScroll, { passive: true })
  el.addEventListener("wheel", onWheel, { passive: true })
  el.addEventListener("pointerdown", onPointerDown)
  win?.addEventListener("pointerup", onPointerUp)
  el.ownerDocument.addEventListener("selectionchange", onSelection)

  return {
    scrollToBottom: (behavior) => scrollTo(el.scrollHeight, behavior),
    scrollChildToTop(child, behavior) {
      const offset = child.getBoundingClientRect().top - el.getBoundingClientRect().top
      scrollTo(el.scrollTop + offset, behavior)
    },
    scrollChildIntoView(child) {
      const c = child.getBoundingClientRect()
      const v = el.getBoundingClientRect()
      if (c.top < v.top) scrollTo(el.scrollTop + c.top - v.top, "instant")
      else if (c.bottom > v.bottom) scrollTo(el.scrollTop + c.bottom - v.bottom, "instant")
    },
    snapshot: () => el.scrollHeight - el.scrollTop,
    restore(fromBottom) {
      const to = el.scrollHeight - fromBottom
      own = { to }
      el.scrollTop = to
      last = el.scrollTop
    },
    destroy() {
      ro?.disconnect()
      el.removeEventListener("scroll", onScroll)
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("pointerdown", onPointerDown)
      win?.removeEventListener("pointerup", onPointerUp)
      el.ownerDocument.removeEventListener("selectionchange", onSelection)
    },
  }
}

/** Calls `onReach` whenever `sentinel` (at the top of `root`) comes into view. */
export function observeTop(root: Element, sentinel: Element, onReach: () => void): () => void {
  const win = root.ownerDocument.defaultView
  if (typeof win?.IntersectionObserver !== "function") return () => {}
  const io = new win.IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) onReach()
    },
    { root },
  )
  io.observe(sentinel)
  return () => io.disconnect()
}
