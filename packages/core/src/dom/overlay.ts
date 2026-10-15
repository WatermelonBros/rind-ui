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
import { containFocus, type FocusEnv, type FocusTarget, focusInitial } from "./focus-scope"
import { hideOutsideModal } from "./inert-outside"
import { getLayerStack, type LayerHandle, type LayerOptions } from "./layer-stack"
import { lockScrollForModals } from "./scroll-lock"

export interface OverlayEffectOptions extends Omit<LayerOptions, "onParentDismissed"> {
  readonly dismiss: DismissOptions
  /** The element focus moves into and is contained in (the content). */
  readonly container: () => HTMLElement | null
  readonly initialFocus?: () => FocusTarget
  /** Where focus returns; receives the dismiss reason (undefined for a programmatic close). */
  readonly finalFocus?: (reason: DismissReason | undefined) => FocusTarget
  /** How the layer was opened (touch focuses the container: no on-screen keyboard). */
  readonly modality: Modality
  /**
   * The content animates out: receives the layer's dispose, to call when presence is absent
   * (presses on the exiting content are not outside meanwhile). Default: disposed at close.
   */
  readonly onExiting?: (dispose: () => void) => void
}

/** How many frames to wait for the content to mount before giving up on focus. */
const MOUNT_FRAMES = 10

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
  // The content may mount after the open transition (a framework renders it next): attach
  // focus once it exists, and let the stack's subscribers recompute with its elements.
  let offContain = () => {}
  let cancelInitial = () => {}
  let frame: ReturnType<typeof env.scheduler.requestAnimationFrame> | null = null
  let stopped = false
  const attach = (frames: number) => {
    const container = options.container()
    if (!container) {
      if (frames > 0) frame = env.scheduler.requestAnimationFrame(() => attach(frames - 1))
      return
    }
    frame = null
    if (options.modal) offContain = containFocus(env, handle, container)
    cancelInitial = focusInitial(env, container, options.initialFocus, options.modality)
    getLayerStack(doc).refresh()
  }
  attach(MOUNT_FRAMES)
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
    else handle.dispose()
  }
}
