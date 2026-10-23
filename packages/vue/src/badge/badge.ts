import { badgeConnect, badgeWarnings, checkBadgeHost } from "@rind-ui/core"
import {
  defineComponent,
  h,
  onMounted,
  onUpdated,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

export interface BadgeState {
  /** A `label` replaces what assistive technology hears. */
  readonly labelled: boolean
}

const Root = defineComponent({
  name: "BadgeRoot",
  inheritAttrs: false,
  props: {
    /** The text assistive technology gets instead of the visible content ("99+"). */
    label: String,
    id: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: BadgeState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const instance = useRootId(() => props.id)
    const el = shallowRef<Element | null>(null)
    const check = () => {
      if (el.value) checkBadgeHost(el.value, props.label)
    }
    onMounted(() => {
      check()
      watch(
        () =>
          JSON.stringify([
            attrs["role"],
            attrs["aria-live"],
            attrs["aria-label"],
            attrs["aria-labelledby"],
          ]),
        () => badgeWarnings(attrs),
        { immediate: true },
      )
    })
    onUpdated(check)
    return () => {
      const api = badgeConnect({ label: props.label, instance: instance() })
      const content = api.content()
      const hidden = api.label()
      const state: BadgeState = { labelled: content !== null }
      const children = slots.default?.(state)
      // With a label the visible content is hidden from assistive technology and the label
      // is read instead; with asChild the child element keeps its own content.
      const body =
        content && hidden && !props.asChild
          ? [
              h("span", normalizeProps(content), children as never),
              h("span", normalizeProps(hidden), props.label),
            ]
          : children
      const merged = mergeProps({ ...normalizeProps(api.root()), ref: refTo(el) }, attrs)
      return renderPart("span", merged, body, props.asChild)
    }
  },
})

/** The parts, by name: `badge.parts.ts` re-exports them as the `Badge` namespace. */
export { Root }
