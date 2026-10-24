import { visuallyHiddenStyle } from "@rind-ui/core"
import { defineComponent, type SlotsType, shallowRef, type VNodeChild } from "vue"
import { mergeProps } from "./merge-props"
import { normalizeProps } from "./normalize-props"
import { asChildProp, renderPart } from "./render"

/** Read by assistive technology, not seen (never `display: none`). */
export const VisuallyHidden = defineComponent({
  name: "VisuallyHidden",
  inheritAttrs: false,
  props: {
    /** Visible while it has focus (skip links). */
    focusable: Boolean,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: { focused: boolean }) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const focused = shallowRef(false)
    return () => {
      const shown = props.focusable && focused.value
      const own = normalizeProps({
        "data-visually-hidden": shown ? undefined : "",
        style: shown ? undefined : visuallyHiddenStyle,
      })
      const merged = mergeProps(
        own,
        props.focusable
          ? { onFocusin: () => (focused.value = true), onFocusout: () => (focused.value = false) }
          : {},
        attrs,
      )
      return renderPart("span", merged, slots.default?.({ focused: focused.value }), props.asChild)
    }
  },
})
