import {
  checkLabelTarget,
  labelConnect,
  labelForwardsFocus,
  labelInteraction,
  labelTarget,
} from "@rind-ui/core"
import { defineComponent, onMounted, onUpdated, shallowRef, watch } from "vue"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"

/** A native `<label>`: names its control through `for` or by wrapping it. */
const LabelRoot = defineComponent({
  name: "RindLabel",
  inheritAttrs: false,
  props: {
    /** The labelled control's id (the `for` attribute). */
    for: String,
    id: String,
    ...asChildProp,
  },
  setup(props, { attrs, slots }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    // Known after mount only: the server keeps the consumer's `for`.
    const nonLabelable = shallowRef(false)
    onMounted(() => {
      measured.value = el.value?.tagName.toLowerCase() ?? null
      watch(
        () => props.for,
        (htmlFor) => {
          if (el.value) nonLabelable.value = checkLabelTarget(el.value, htmlFor)
        },
        { immediate: true },
      )
    })
    onUpdated(() => (measured.value = el.value?.tagName.toLowerCase() ?? null))
    return () => {
      const children = slots["default"]?.()
      const tag = renderedTag("label", children, props.asChild, measured.value)
      const forwardsFocus = labelForwardsFocus(tag, nonLabelable.value)
      const own = normalizeProps(
        labelConnect({
          instance: instance(),
          id: instance(),
          htmlFor: props.for,
          tag,
          forwardsFocus,
        }),
      )
      const interaction = normalizeProps(
        labelInteraction(env, {
          target: () => (el.value ? labelTarget(el.value, props.for) : null),
          forwardsFocus: () => forwardsFocus,
        }),
      )
      const merged = mergeProps({ ...own, ...interaction, ref: refTo(el) }, attrs)
      return renderPart("label", merged, children, props.asChild)
    }
  },
})

export const Label = Object.assign(LabelRoot, { Root: LabelRoot })
