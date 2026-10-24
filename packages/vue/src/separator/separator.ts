import {
  droppedNameProps,
  type SeparatorContext,
  type SeparatorInput,
  type SeparatorOrientation,
  separatorProps,
  separatorWarnings,
} from "@rind-ui/core"
import {
  type ComputedRef,
  defineComponent,
  type InjectionKey,
  inject,
  onMounted,
  onUpdated,
  type PropType,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"

/**
 * What a container tells the separators inside it (a Toolbar: context `toolbar`, the
 * perpendicular default orientation; a listbox popup: `listbox`).
 */
export interface SeparatorHost {
  readonly context: SeparatorContext
  readonly defaultOrientation?: SeparatorOrientation | undefined
}
export const SeparatorHostKey: InjectionKey<ComputedRef<SeparatorHost | null>> =
  Symbol("rind-ui.separator-host")

export interface SeparatorState {
  readonly orientation: SeparatorOrientation
  readonly decorative: boolean
}

const VOID = new Set(["hr", "br", "img", "input", "wbr"])

const Root = defineComponent({
  name: "SeparatorRoot",
  inheritAttrs: false,
  props: {
    /** Default: the container's, else `horizontal`. */
    orientation: String as PropType<SeparatorOrientation>,
    /** Purely visual: `role="none"`, removed from the accessibility tree. */
    decorative: Boolean,
    id: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: SeparatorState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const host = inject(SeparatorHostKey, null)
    const instance = useRootId(() => props.id)
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    let latest: SeparatorInput | undefined
    onMounted(() => (measured.value = el.value?.tagName.toLowerCase() ?? null))
    onUpdated(() => (measured.value = el.value?.tagName.toLowerCase() ?? null))
    // Warnings once per change of what they read (not on every render).
    onMounted(() =>
      watch(
        () =>
          JSON.stringify([
            props.orientation,
            props.decorative,
            host?.value?.context,
            attrs["tabindex"],
            attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined,
          ]),
        () => latest && separatorWarnings(latest),
        { immediate: true },
      ),
    )
    return () => {
      const probe: SeparatorState = { orientation: "horizontal", decorative: props.decorative }
      const children = slots.default?.(probe)
      const tag = renderedTag("div", children, props.asChild, measured.value)
      const input: SeparatorInput = {
        orientation: props.orientation,
        defaultOrientation: host?.value?.defaultOrientation,
        decorative: props.decorative,
        tag,
        context: host?.value?.context ?? "content",
        instance: instance(),
        own: attrs,
      }
      latest = input
      const consumer: Record<string, unknown> = { ...attrs }
      for (const name of droppedNameProps(input)) delete consumer[name]
      const own = normalizeProps(separatorProps(input))
      const merged = mergeProps(
        {
          ...own,
          ...(props.id === undefined ? {} : { id: props.id }),
          ref: refTo(el),
        },
        consumer,
      )
      return renderPart(
        "div",
        merged,
        VOID.has(tag) && !props.asChild ? undefined : children,
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `separator.parts.ts` re-exports them as the `Separator` namespace. */
export { Root }
