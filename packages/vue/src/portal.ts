import { portalHostAttributes, resolvePortalTarget, syncPortalHost } from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  Teleport,
  type VNodeChild,
  watch,
} from "vue"
import { CompositeHostKey } from "./composite-host"
import { mergeProps, refTo } from "./merge-props"
import { asChildProp, renderPart } from "./render"
import { SeparatorHostKey } from "./separator/separator"

const sameAttributes = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

/**
 * Renders its slot into a host `div[data-rind-portal]` outside the tree. Nothing on the
 * server and nothing during hydration (no mismatch: radix#1386); mounts after. The host
 * carries the logical parent's dir, lang, data-rind-theme and data-theme, kept in sync, and
 * follows a changing `container` (radix#3599).
 */
export const Portal = defineComponent({
  name: "RindPortal",
  inheritAttrs: false,
  props: {
    /** Where to render (default: resolved from the logical parent, then `body`). */
    container: Object as PropType<Element | ShadowRoot | null>,
    /** The element the content belongs to (its trigger): target resolution and dir/lang/theme. */
    logicalParent: Function as PropType<() => Element | null>,
    /**
     * Keeps the host's `dir`, `lang` and theme in step with the logical parent as they change;
     * `false` copies them once. Default: true.
     */
    observe: { type: Boolean, default: true },
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { attrs, slots }) {
    // A component in a popup is not hosted by the toolbar its trigger sits in (nor are its
    // separators drawn in the toolbar's context).
    provide(CompositeHostKey, null)
    provide(
      SeparatorHostKey,
      computed(() => null),
    )
    const parent = () => props.logicalParent?.() ?? null
    const mounted = shallowRef(false)
    const attributes = shallowRef<Record<string, string>>({})
    const host = shallowRef<Element | null>(null)
    // A logical parent that changes (a dialog's opener, set on open) is followed at once: the
    // host's observer only sees attribute mutations, not a different parent element.
    const read = () => {
      const next = portalHostAttributes(parent())
      if (!sameAttributes(attributes.value, next)) attributes.value = next
    }
    onMounted(() => {
      // The first render after mount already has the right attributes (no flash in the wrong dir).
      read()
      mounted.value = true
    })
    onUpdated(read)
    // A new container remounts the host: the sync follows the new element.
    watch(
      [host, () => props.observe] as const,
      ([el, observe], _, onCleanup) => {
        if (el) onCleanup(syncPortalHost(el, parent, observe))
      },
      { flush: "post" },
    )
    return () => {
      if (!mounted.value) return null
      // Teleport inserts into any node: a shadow root is a valid parent.
      const to = resolvePortalTarget(parent(), props.container) as Element
      const merged = mergeProps(
        { "data-rind-portal": "", ...attributes.value, ref: refTo(host) },
        attrs,
      )
      return h(Teleport, { to }, [renderPart("div", merged, slots.default?.(), props.asChild)])
    }
  },
})
