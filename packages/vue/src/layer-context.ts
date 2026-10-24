import type { LayerId, LayerKind } from "@rind-ui/core"
import { defineComponent, type InjectionKey, inject, type PropType, provide } from "vue"

interface LayerLink {
  readonly id: LayerId
  /** Undefined for a layer that did not declare one (any kind matches it). */
  readonly kind: LayerKind | undefined
  readonly up: LayerLink | undefined
}

/** Injection crosses teleports: a portalled layer's parent is where it was declared. */
const LayerKey: InjectionKey<LayerLink | undefined> = Symbol("rind-ui.layer")

/** Declares this component's layer as the parent of every layer rendered below. Call in setup. */
export function provideLayer(layer: () => LayerId, kind?: () => LayerKind | undefined): void {
  const up = inject(LayerKey, undefined)
  provide(LayerKey, {
    get id() {
      return layer()
    },
    get kind() {
      return kind?.()
    },
    up,
  })
}

/** Declares the parent layer for every layer rendered below (explicit parentage). */
export const LayerProvider = defineComponent({
  name: "LayerProvider",
  props: {
    layer: { type: String as unknown as PropType<LayerId>, required: true },
    kind: String as PropType<LayerKind>,
  },
  setup(props, { slots }) {
    provideLayer(
      () => props.layer,
      () => props.kind,
    )
    return () => slots["default"]?.()
  },
})

/**
 * The layer this component is rendered in, if any: its parent when it opens a layer. With
 * `kinds`, the nearest enclosing layer of one of those kinds (a dialog rendered inside a menu
 * is not the menu's child: radix#1836); a layer that declared no kind never matches then.
 * Call in setup; read the getter when needed.
 */
export function useParentLayer(kinds?: readonly LayerKind[]): () => LayerId | undefined {
  const start = inject(LayerKey, undefined)
  return () => {
    let link = start
    while (link && kinds && (link.kind === undefined || !kinds.includes(link.kind))) link = link.up
    return link?.id
  }
}
