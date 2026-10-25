// The layer a part is rendered in: a portalled layer's parent is where it was declared (DI
// follows the declaration, across the portal).
import {
  afterNextRender,
  effect,
  InjectionToken,
  inject,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
import { getLayerStack, type LayerId, type LayerKind, type LayerMeta } from "@rind-ui/core"
import { injectEnvironment } from "./provider"

interface LayerLink {
  readonly id: () => LayerId
  /** Undefined for a layer that did not declare one (any kind matches it). */
  readonly kind: () => LayerKind | undefined
  readonly up: LayerLink | null
}

export const LAYER = new InjectionToken<LayerLink | null>("rind-ui.layer")

/** The provider a layer's part declares: it is the parent of every layer rendered below. */
export function layerProvider(layer: () => LayerId, kind?: () => LayerKind | undefined): LayerLink {
  return {
    id: layer,
    kind: kind ?? (() => undefined),
    up: inject(LAYER, { optional: true, skipSelf: true }),
  }
}

/**
 * The layer this part is rendered in, if any: its parent when it opens a layer. With `kinds`,
 * the nearest enclosing layer of one of those kinds (a dialog rendered inside a menu is not the
 * menu's child: radix#1836); a layer that declared no kind never matches then.
 */
export function injectParentLayer(kinds?: readonly LayerKind[]): () => LayerId | undefined {
  const start = inject(LAYER, { optional: true })
  return () => {
    let link = start
    while (link && kinds) {
      const kind = link.kind()
      if (kind !== undefined && kinds.includes(kind)) break
      link = link.up
    }
    return link?.id()
  }
}

/** A signal set after the first render (browser only): effects that read the DOM wait on it. */
export function injectRendered(): Signal<boolean> {
  const ready = signal(false)
  if (inject(PLATFORM_ID) === "browser") afterNextRender(() => ready.set(true))
  return ready
}

/** The layer stack's metadata for layer `id`, followed while `open` (undefined otherwise). */
export function injectLayerMeta(
  open: () => boolean,
  id: () => LayerId,
): Signal<LayerMeta | undefined> {
  const meta = signal<LayerMeta | undefined>(undefined)
  if (inject(PLATFORM_ID) !== "browser") return meta
  const env = injectEnvironment()
  const ready = injectRendered()
  effect((onCleanup) => {
    if (!ready()) return
    const shown = open()
    const layer = id()
    untracked(() => {
      meta.set(undefined)
      if (!shown) return
      const node = env.dom.getRootNode()
      const stack = getLayerStack("body" in node ? node : node.ownerDocument)
      const read = () => meta.set(stack.get(layer)?.meta())
      read()
      onCleanup(stack.subscribe(read))
    })
  })
  return meta
}
