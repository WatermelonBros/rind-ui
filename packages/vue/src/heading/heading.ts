import {
  type HeadingLevel,
  headingConnect,
  nextHeadingLevel,
  resolveHeadingLevel,
  tooDeep,
  warnEmptyHeading,
  warnTooDeep,
} from "@rind-ui/core"
import {
  type ComputedRef,
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"

/** The raw (unclamped) level of the nearest `Heading.Level`; injection crosses teleports. */
const HeadingLevelKey: InjectionKey<ComputedRef<number | undefined>> = Symbol("rind-ui.heading")

/** The level a heading gets at this position in the component tree (1–6). Call in setup. */
export function useHeadingLevel(): ComputedRef<HeadingLevel> {
  const context = inject(HeadingLevelKey, null)
  return computed(() => resolveHeadingLevel(undefined, context?.value))
}

/** The level the nearest `Heading.Level` gives (unclamped), or undefined outside any. */
export function useHeadingContextLevel(): ComputedRef<number | undefined> {
  const context = inject(HeadingLevelKey, null)
  return computed(() => context?.value)
}

/** A section: sets the level of the headings below it. Renders no element. */
const HeadingLevelSection = defineComponent({
  name: "HeadingLevel",
  props: {
    /** The level for the headings below; default: one more than the level around it. */
    level: Number as PropType<HeadingLevel>,
  },
  setup(props, { slots }) {
    const parent = inject(HeadingLevelKey, null)
    provide(
      HeadingLevelKey,
      computed(() => nextHeadingLevel(parent?.value, props.level)),
    )
    return () => slots["default"]?.()
  },
})

export interface HeadingState {
  readonly level: HeadingLevel
}

const HeadingRoot = defineComponent({
  name: "RindHeading",
  inheritAttrs: false,
  props: {
    /** Overrides the level from the nesting. */
    level: Number as PropType<HeadingLevel>,
    id: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: HeadingState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const context = inject(HeadingLevelKey, null)
    const instance = useRootId(() => props.id)
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    let warnedDeep = false
    const check = () => {
      measured.value = el.value?.tagName.toLowerCase() ?? null
      const ctx = context?.value
      if (props.level === undefined && tooDeep(ctx) && ctx !== undefined && !warnedDeep) {
        warnedDeep = true
        warnTooDeep(ctx)
      }
      if (el.value) warnEmptyHeading(el.value)
    }
    onMounted(check)
    onUpdated(check)
    return () => {
      const level = resolveHeadingLevel(props.level, context?.value)
      const children = slots.default?.({ level })
      const tag = renderedTag(`h${level}`, children, props.asChild, measured.value)
      const own = normalizeProps(headingConnect({ level, tag, instance: instance() }))
      const merged = mergeProps(
        {
          ...own,
          ...(props.id === undefined ? {} : { id: props.id }),
          ref: refTo(el),
        },
        attrs,
      )
      return renderPart(`h${level}`, merged, children, props.asChild)
    }
  },
})

/** A heading whose level follows the nesting of `Heading.Level` sections (default 2). */
export const Heading = Object.assign(HeadingRoot, { Level: HeadingLevelSection })
