// The one effect an overlay component's machine injects while open: registers the layer,
// makes it dismissable, installs the document's outside-hiding and scroll-lock singletons,
// contains focus when modal and moves focus in. The cleanup (close, or stop() on unmount,
// navigation, Strict Mode) runs the same path in a fixed order: release the layer, let the
// singletons drop inert and the scroll lock synchronously, THEN restore focus — focus() on a
// still-inert trigger is a no-op (react-spectrum#10610).

import type { Modality } from "../contract/env"
import type { PlatformInfo } from "../env/capabilities"
import { type DismissOptions, type DismissReason, dismissable, dismissRequest } from "./dismiss"
import { captureFocus } from "./focus-restore"
import {
  containFocus,
  deepActiveElement,
  type FocusEnv,
  type FocusTarget,
  focusInitial,
} from "./focus-scope"
import { hideOutsideModal } from "./inert-outside"
import { getLayerStack, type LayerHandle, type LayerOptions } from "./layer-stack"
import { waitForExit } from "./presence"
import { lockScrollForModals } from "./scroll-lock"

declare const process: { env: { NODE_ENV?: string } }

export interface OverlayEffectOptions extends Omit<LayerOptions, "onParentDismissed"> {
  readonly dismiss: DismissOptions
  /** The element focus moves into and is contained in (the content). */
  readonly container: () => HTMLElement | null
  readonly initialFocus?: () => FocusTarget
  /** Where focus returns; receives the dismiss reason (undefined for a programmatic close). */
  readonly finalFocus?: (reason: DismissReason | undefined) => FocusTarget
  /** How the layer was opened (touch focuses the container: no on-screen keyboard). */
  /** Tab closes the layer and moves on from its opener (a select, a menu): never wrapped. */
  readonly tabCloses?: boolean | undefined
  readonly modality: Modality
  /**
   * The content animates out: receives the layer's dispose, to call when presence is absent
   * (presses on the exiting content are not outside meanwhile). Default: disposed once the
   * layer's elements finish their exit animations.
   */
  readonly onExiting?: (dispose: () => void) => void
}

/** Frames of waiting for the content after which a dev warning says it never mounted. */
const SLOW_MOUNT_FRAMES = 120

/** Runs while the overlay is open; returns the cleanup that closes it down. */
export function overlayEffect(
  env: FocusEnv & PlatformInfo,
  options: OverlayEffectOptions,
): () => void {
  if (typeof document === "undefined") return () => {}
  const root = env.dom.getRootNode()
  const doc = "body" in root ? root : root.ownerDocument
  let reason: DismissReason | undefined
  const request = (r: Parameters<DismissOptions["onRequest"]>[0]) => {
    reason = r.reason
    options.dismiss.onRequest(r)
    if (r.canceled) reason = undefined
  }
  // Focus at open time: a move after it (autoFocus in the content) is the app's, kept.
  const focusAtOpen = deepActiveElement(doc)
  const handle: LayerHandle = getLayerStack(doc).push({
    ...options,
    onParentDismissed: () => request(dismissRequest("parent-dismissed", undefined, null)),
  })
  hideOutsideModal(doc)
  lockScrollForModals(doc, env.platform)
  const focusReturn = captureFocus(env, handle, doc, options.opener)
  const offDismiss = dismissable(env, handle, {
    ...options.dismiss,
    modal: options.modal,
    onRequest: request,
  })
  // The content may mount after the open transition (a framework renders it next, Suspense,
  // a lazy chunk): keep looking every frame until it exists or the layer closes, never
  // giving up — a modal that attached nothing would trap nothing. Then let the stack's
  // subscribers recompute with its elements.
  let offContain = () => {}
  let cancelInitial = () => {}
  let frame: ReturnType<typeof env.scheduler.requestAnimationFrame> | null = null
  let stopped = false
  const attach = (waited: number) => {
    const container = options.container()
    if (!container) {
      if (process.env.NODE_ENV !== "production" && waited === SLOW_MOUNT_FRAMES) {
        console.warn(
          `[rind-ui] overlay ${options.id}: its content has not mounted after ${SLOW_MOUNT_FRAMES} frames; focus and containment wait for it`,
        )
      }
      frame = env.scheduler.requestAnimationFrame(() => attach(waited + 1))
      return
    }
    frame = null
    if (options.modal) {
      offContain = containFocus(env, handle, container, { tabCloses: options.tabCloses })
    }
    cancelInitial = focusInitial(
      env,
      container,
      options.initialFocus,
      options.modality,
      focusAtOpen,
    )
    getLayerStack(doc).refresh()
  }
  attach(0)
  return () => {
    if (stopped) return
    stopped = true
    if (frame !== null) env.scheduler.cancelAnimationFrame(frame)
    cancelInitial()
    offDismiss()
    offContain()
    // Synchronous: the stack's subscribers remove inert and the scroll lock right here.
    handle.release()
    const finalFocus = options.finalFocus
    focusReturn.restore(finalFocus ? () => finalFocus(reason) : undefined)
    if (options.onExiting) options.onExiting(() => handle.dispose())
    // A tooltip is never pressed, and its trigger still describes itself by the exiting
    // content: marking it inert while it fades would hide that description.
    else if (options.kind === "tooltip") handle.dispose()
    else disposeAfterExit(env, options.elements, () => handle.dispose())
  }
}

const seconds = (list: string) => list.split(",").some((t) => Number.parseFloat(t) > 0)
/** A transition or an animation declared on the part (an exit animation can only be these). */
function mayAnimate(el: Element): boolean {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el)
  if (!style) return false
  return (
    seconds(style.transitionDuration) ||
    (style.animationName !== "" && style.animationName !== "none")
  )
}

/**
 * The released layer stays known as exiting while its parts animate out, so a press on its
 * fading backdrop is not outside the layer beneath (react-spectrum#10291). One frame first:
 * the framework applies the closed state, which starts the exit animations.
 */
function disposeAfterExit(
  env: FocusEnv,
  elements: () => readonly Element[],
  dispose: () => void,
): void {
  // No part declares a transition or an animation: there is no exit to wait for (and a
  // part kept mounted must not stay inert a frame longer than its close).
  if (!elements().some(mayAnimate)) return dispose()
  env.scheduler.requestAnimationFrame(() => {
    void Promise.all(elements().map((el) => waitForExit(el))).then(dispose)
  })
}
