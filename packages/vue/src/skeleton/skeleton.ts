import {
  announcerCapability,
  type MessageOverrides,
  type SkeletonMessages,
  skeletonConnect,
  skeletonMachine,
  skeletonMessages,
  warnStatusPlacement,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    skeleton: SkeletonMessages
  }
}

export interface SkeletonState {
  readonly loading: boolean
}

interface Ctx {
  readonly connect: () => ReturnType<typeof skeletonConnect>
  readonly messages: () => SkeletonMessages
  readonly loading: () => boolean
}
const SkeletonKey: InjectionKey<Ctx> = Symbol("rind-ui.skeleton")
function useSkeleton(part: string): Ctx {
  const ctx = inject(SkeletonKey, null)
  if (!ctx) throw new Error(`Skeleton.${part} must be inside Skeleton.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: SkeletonState) => VNodeChild }>

const Root = defineComponent({
  name: "SkeletonRoot",
  inheritAttrs: false,
  props: {
    /** Default `true`: the whole area is loading. */
    loading: { type: Boolean, default: true },
    /** Announce politely on `loading → loaded`: `true` for `messages.loaded`, or the text. */
    announceOnLoad: { type: [Boolean, String], default: undefined },
    /** Default `true`: Items carry `data-animate` while loading. */
    animate: { type: Boolean, default: true },
    messages: Object as PropType<MessageOverrides<SkeletonMessages>>,
    id: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const instance = useRootId(() => props.id)
    const messages = useMessages("skeleton", skeletonMessages, () => props.messages)
    const locale = useLocale(() => undefined)
    const env = useEnvironment(announcerCapability)
    const { view } = useMachine(
      skeletonMachine,
      () => ({
        loading: props.loading,
        announceOnLoad: props.announceOnLoad,
        messages: messages.value,
        id: instance(),
        lang: locale.value.locale,
      }),
      env,
    )
    const loading = computed(() => view.value.state === "loading")
    const connect = computed(() =>
      skeletonConnect({ instance: instance(), loading: loading.value, animate: props.animate }),
    )
    provide(SkeletonKey, {
      connect: () => connect.value,
      messages: () => messages.value,
      loading: () => loading.value,
    })
    return () => {
      const merged = mergeProps(
        {
          ...normalizeProps(connect.value.root()),
          ...(props.id === undefined ? {} : { id: props.id }),
        },
        attrs,
      )
      return renderPart("div", merged, slots.default?.({ loading: loading.value }), props.asChild)
    }
  },
})

/** The loading text, visually hidden, outside Content; renders nothing when loaded. */
const Status = defineComponent({
  name: "SkeletonStatus",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSkeleton("Status")
    const el = shallowRef<Element | null>(null)
    onMounted(() =>
      // The element mounts again on reload.
      watch(
        () => [ctx.loading(), el.value],
        () => {
          if (el.value) warnStatusPlacement(el.value)
        },
        { immediate: true, flush: "post" },
      ),
    )
    return () => {
      const own = ctx.connect().status()
      if (!own) return null
      const merged = mergeProps({ ...normalizeProps(own), ref: refTo(el) }, attrs)
      const children = slots.default?.({ loading: ctx.loading() }) ?? ctx.messages().loading
      return renderPart("span", merged, children, props.asChild)
    }
  },
})

/** The loading region: `aria-busy` while loading. */
const Content = defineComponent({
  name: "SkeletonContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSkeleton("Content")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.connect().content()), attrs),
        slots.default?.({ loading: ctx.loading() }),
        props.asChild,
      )
  },
})

/** A placeholder, or a wrapper hiding stale content while loading. */
const Item = defineComponent({
  name: "SkeletonItem",
  inheritAttrs: false,
  props: {
    /** Overrides the Root's state for this Item. */
    loading: { type: Boolean, default: undefined },
    /** Overrides the Root's `animate`. */
    animate: { type: Boolean, default: undefined },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSkeleton("Item")
    return () => {
      const own = ctx.connect().item({
        loading: props.loading,
        animate: props.animate,
        // Stale content when the slot rendered something; none: a placeholder.
        hasChildren: slots.default !== undefined,
      })
      const children = slots.default?.({ loading: own["data-state"] === "loading" })
      return renderPart("span", mergeProps(normalizeProps(own), attrs), children, props.asChild)
    }
  },
})

/** The parts, by name: `skeleton.parts.ts` re-exports them as the `Skeleton` namespace. */
export { Content, Item, Root, Status }
