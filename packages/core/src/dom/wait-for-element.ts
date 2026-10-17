// Waiting for an element that is not there yet (design §3): one synchronous attempt, then a
// `MutationObserver` on the document or shadow root, coalesced to one resolver call per
// microtask — never polling. "There" means rendered: connected, visible, with a box.

import type { Scheduler } from "../env/capabilities"

/** Connected, not hidden (`display: none`, `visibility: hidden`), with a non-empty box. */
export function isRendered(el: Element | null | undefined): el is Element {
  if (!el?.isConnected) return false
  const check = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility
  if (typeof check === "function") {
    if (!check.call(el, { visibilityProperty: true })) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 || r.height > 0
  }
  // No checkVisibility (older engines, jsdom): the computed styles of the element and its
  // ancestors. jsdom has no layout, so the box is not required here.
  const view = el.ownerDocument.defaultView
  if (!view) return true
  if (view.getComputedStyle(el).visibility === "hidden") return false
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (n.hasAttribute("hidden") || view.getComputedStyle(n).display === "none") return false
  }
  return true
}

/** Rejects with this when aborted or timed out. */
export class WaitAbortedError extends Error {
  override readonly name = "WaitAbortedError"
}

export interface WaitForElementOptions {
  /** The document or shadow root to observe (default: the document). */
  readonly root?: Document | ShadowRoot | undefined
  readonly signal?: AbortSignal | undefined
  /** Milliseconds before rejecting (default: none). */
  readonly timeout?: number | undefined
  /** Timer source for `timeout` (default: the global timers). */
  readonly scheduler?: Pick<Scheduler, "setTimeout" | "clearTimeout"> | undefined
}

const aborted = (signal: AbortSignal | undefined) =>
  new WaitAbortedError(signal?.reason instanceof Error ? signal.reason.message : "aborted")

/** Resolves with the first rendered element `resolver` returns. */
export function waitForElement<T extends Element>(
  resolver: () => T | null | undefined,
  options: WaitForElementOptions = {},
): Promise<T> {
  const { signal } = options
  if (signal?.aborted) return Promise.reject(aborted(signal))
  const first = resolver()
  if (isRendered(first)) return Promise.resolve(first)
  const root = options.root ?? (typeof document === "undefined" ? undefined : document)
  if (!root) return Promise.reject(new WaitAbortedError("no document"))
  return new Promise<T>((resolve, reject) => {
    const timers = options.scheduler ?? {
      setTimeout: (cb: () => void, ms: number) => globalThis.setTimeout(cb, ms),
      clearTimeout: (h: unknown) => globalThis.clearTimeout(h as number),
    }
    let queued = false
    const finish = () => {
      observer.disconnect()
      signal?.removeEventListener("abort", onAbort)
      if (timer !== undefined) timers.clearTimeout(timer)
    }
    const check = () => {
      queued = false
      const el = resolver()
      if (!isRendered(el)) return
      finish()
      resolve(el)
    }
    const observer = new MutationObserver(() => {
      if (queued) return
      queued = true
      queueMicrotask(check)
    })
    const onAbort = () => {
      finish()
      reject(aborted(signal))
    }
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "open"],
    })
    signal?.addEventListener("abort", onAbort, { once: true })
    const timer =
      options.timeout === undefined
        ? undefined
        : timers.setTimeout(() => {
            finish()
            reject(new WaitAbortedError("timeout"))
          }, options.timeout)
  })
}

export interface WaitForEventOptions<E extends Event> {
  readonly predicate?: ((event: E) => boolean) | undefined
  readonly signal?: AbortSignal | undefined
}

/** Resolves with the next `type` event on `target`; rejects at once when there is none. */
export function waitForEvent<E extends Event = Event>(
  target: EventTarget | null | undefined,
  type: string,
  options: WaitForEventOptions<E> = {},
): Promise<E> {
  const { signal, predicate } = options
  if (!target) return Promise.reject(new WaitAbortedError(`no target for "${type}"`))
  if (signal?.aborted) return Promise.reject(aborted(signal))
  return new Promise<E>((resolve, reject) => {
    const off = () => {
      target.removeEventListener(type, onEvent)
      signal?.removeEventListener("abort", onAbort)
    }
    const onEvent = (e: Event) => {
      // Sound: the listener is registered for `type`, whose events the caller typed as E.
      const event = e as E
      if (predicate && !predicate(event)) return
      off()
      resolve(event)
    }
    const onAbort = () => {
      off()
      reject(aborted(signal))
    }
    target.addEventListener(type, onEvent)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}
