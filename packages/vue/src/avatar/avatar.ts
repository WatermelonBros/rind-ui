import {
  type AvatarMessages,
  type AvatarProps,
  type AvatarStatus,
  avatarConnect,
  avatarGroupOverflowProps,
  avatarGroupProps,
  avatarMessages,
  checkAvatarGroupName,
  checkAvatarName,
  checkImageAlt,
  checkImageCount,
  isAvatarHidden,
  isAvatarNamed,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  type VNodeChild,
  watch,
} from "vue"
import { type ImageHost, useImageStatusRoot, useStatusImage } from "../image-status"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { VisuallyHidden } from "../visually-hidden"

declare module "../provider" {
  interface RindMessageScopes {
    avatar: AvatarMessages
  }
}

export interface AvatarState {
  readonly status: AvatarStatus
}

interface Ctx {
  readonly api: () => ReturnType<typeof avatarConnect>
  readonly host: ImageHost
  readonly state: () => AvatarState
  readonly fallback: () => boolean
  readonly name: () => string | undefined
}
const AvatarKey: InjectionKey<Ctx> = Symbol("rind-ui.avatar")
function useAvatar(part: string): Ctx {
  const ctx = inject(AvatarKey, null)
  if (!ctx) throw new Error(`Avatar.${part} must be inside Avatar.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: AvatarState) => VNodeChild }>

const Root = defineComponent({
  name: "AvatarRoot",
  inheritAttrs: false,
  props: {
    /** Milliseconds the Fallback waits while the image is loading (default 0). Client-only. */
    fallbackDelay: Number,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** Every status change (observed, not controlled). */
    statusChange: (..._args: Parameters<NonNullable<AvatarProps["onStatusChange"]>>) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const { status, fallback, host } = useImageStatusRoot(
      () => ({
        fallbackDelay: props.fallbackDelay,
        onStatusChange: (...args) => emit("statusChange", ...args),
      }),
      () => checkAvatarName(attrs, instance()),
    )
    const api = computed(() =>
      avatarConnect({
        instance: instance(),
        status: status.value,
        named: isAvatarNamed(attrs),
        hidden: isAvatarHidden(attrs),
      }),
    )
    provide(AvatarKey, {
      api: () => api.value,
      host,
      state: () => ({ status: status.value }),
      fallback: () => fallback.value,
      name: () => (typeof attrs["aria-label"] === "string" ? attrs["aria-label"] : undefined),
    })
    return () => {
      const merged = mergeProps(
        {
          ...normalizeProps(api.value.root()),
          ...(props.id === undefined ? {} : { id: props.id }),
        },
        attrs,
      )
      return renderPart("span", merged, slots.default?.({ status: status.value }), props.asChild)
    }
  },
})

const Image = defineComponent({
  name: "AvatarImage",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAvatar("Image")
    const image = useStatusImage(
      ctx.host,
      (has) => normalizeProps(ctx.api().image(has)),
      attrs,
      checkImageCount,
    )
    onMounted(() =>
      watch(
        () => [attrs["alt"], ctx.name()] as const,
        ([alt, name]) => checkImageAlt(alt as string | undefined, name),
        {
          immediate: true,
        },
      ),
    )
    return () => renderPart("img", image(), slots.default?.(ctx.state()), props.asChild)
  },
})

const Fallback = defineComponent({
  name: "AvatarFallback",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAvatar("Fallback")
    return () =>
      ctx.fallback()
        ? renderPart(
            "span",
            mergeProps(normalizeProps(ctx.api().fallback()), attrs),
            slots.default?.(ctx.state()),
            props.asChild,
          )
        : null
  },
})

const Group = defineComponent({
  name: "AvatarGroup",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  setup(props, { attrs, slots }) {
    const instance = useRootId(() => props.id)
    // A development check, once.
    onMounted(() => checkAvatarGroupName(attrs))
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(avatarGroupProps(instance())),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots["default"]?.(),
        props.asChild,
      )
  },
})

const GroupOverflow = defineComponent({
  name: "AvatarGroupOverflow",
  inheritAttrs: false,
  props: {
    /** How many avatars are not shown. */
    count: { type: Number, required: true },
    messages: Object as PropType<Partial<AvatarMessages>>,
    id: String,
    ...asChildProp,
  },
  setup(props, { attrs }) {
    const instance = useRootId(() => props.id)
    const messages = useMessages("avatar", avatarMessages, () => props.messages)
    return () =>
      renderPart(
        "span",
        mergeProps(
          {
            ...normalizeProps(avatarGroupOverflowProps(instance())),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        [
          h("span", { "aria-hidden": "true" }, `+${props.count}`),
          h(VisuallyHidden, null, () => messages.value.overflowLabel(props.count)),
        ],
        props.asChild,
      )
  },
})

/** The parts, by name: `avatar.parts.ts` re-exports them as the `Avatar` namespace. */
export { Fallback, Group, GroupOverflow, Image, Root }
