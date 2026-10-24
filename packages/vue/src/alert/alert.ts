import {
  type AlertAnnounce,
  type AlertEvent,
  type AlertMessages,
  alertConnect,
  alertMachine,
  alertMessages,
  alertWarnings,
  announceableText,
  announcerCapability,
  type ChangeDetails,
  focusPast,
  type MessageOverrides,
  observeText,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  isVNode,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { changeEmitter } from "../emit-change"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { presentAtLoad } from "../present-at-load"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

declare module "../provider" {
  interface RindMessageScopes {
    alert: AlertMessages
  }
}

export interface AlertState {
  readonly open: boolean
}

interface Ctx {
  readonly connect: () => ReturnType<typeof alertConnect>
  readonly open: () => boolean
  readonly root: { readonly value: Element | null }
  readonly send: (event: AlertEvent) => void
}
const AlertKey: InjectionKey<Ctx> = Symbol("rind-ui.alert")
function useAlert(part: string): Ctx {
  const ctx = inject(AlertKey, null)
  if (!ctx) throw new Error(`Alert.${part} must be inside Alert.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: AlertState) => VNodeChild }>

const Root = defineComponent({
  name: "AlertRoot",
  inheritAttrs: false,
  props: {
    /** Default `"polite"`: `"assertive"` for errors and failures, `"off"` for static content. */
    announce: String as PropType<AlertAnnounce>,
    /** Announced instead of the Icon label, Title and Description joined. */
    announcement: String,
    /** Controlled visibility (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: undefined },
    /**
     * Where focus goes when the alert is dismissed with focus inside it. Default (or `null`):
     * the next tab stop after the alert, else the previous one. `false`: focus does not move.
     */
    finalFocus: Function as PropType<() => HTMLElement | null | false>,
    messages: Object as PropType<MessageOverrides<AlertMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    openChange: (_open: boolean, _details: ChangeDetails<AlertEvent>) => true,
    "update:open": (_open: boolean) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability)
    const messages = useMessages("alert", alertMessages, () => props.messages)
    const locale = useLocale(() => undefined)
    const el = shallowRef<Element | null>(null)
    const onOpenChange = changeEmitter<boolean, AlertEvent>(
      (v, d) => emit("openChange", v, d),
      (v) => emit("update:open", v),
    )
    const { view, send } = useMachine(
      alertMachine,
      () => ({
        open: props.open,
        defaultOpen: props.defaultOpen,
        onOpenChange,
        announce: props.announce,
        announcement: props.announcement,
        messages: messages.value,
        id: instance(),
        lang: locale.value.locale,
        moveFocusOut: () => {
          if (el.value instanceof HTMLElement)
            focusPast(el.value, props.finalFocus?.(), env, "alert")
        },
      }),
      env,
    )
    const isOpen = computed(() => view.value.state === "open")
    const presence = usePresence(() => isOpen.value, el)
    // A hydrated alert was present at load and stays silent.
    const hydrating = presentAtLoad("alert", "root", instance())
    const text = () => (el.value instanceof HTMLElement ? announceableText(el.value) : [])
    onMounted(() => {
      send({ type: "ROOT.MOUNT", hydrating, segments: text() })
      // Shown again (`open` became true): the text read from what was rendered, so a change
      // made while it was unmounted is announced once, as it is now.
      watch(
        isOpen,
        (now, before) => {
          if (now && !before) send({ type: "ROOT.SHOW", segments: text() })
        },
        { flush: "post" },
      )
      // Every change of the rendered text while the element is mounted.
      let stop: (() => void) | undefined
      watch(
        () => [presence.mounted, (props.announce ?? "polite") !== "off", el.value] as const,
        ([mounted, live, node]) => {
          stop?.()
          stop = undefined
          if (mounted && live && node instanceof HTMLElement)
            stop = observeText(node, (segments) => send({ type: "CONTENT.CHANGE", segments }))
        },
        { immediate: true, flush: "post" },
      )
      onBeforeUnmount(() => stop?.())
      watch(
        () => JSON.stringify([attrs["role"], attrs["aria-live"], attrs["aria-atomic"]]),
        () => alertWarnings(attrs),
        { immediate: true },
      )
    })
    const connect = computed(() =>
      alertConnect({
        instance: instance(),
        open: isOpen.value,
        dismissLabel: messages.value.dismiss,
      }),
    )
    provide(AlertKey, { connect: () => connect.value, open: () => isOpen.value, root: el, send })
    return () => {
      if (!presence.mounted) return null
      const merged = mergeProps(
        {
          ...normalizeProps(connect.value.root()),
          ...(props.id === undefined ? {} : { id: props.id }),
          ref: refTo(el),
        },
        attrs,
      )
      return renderPart("div", merged, slots.default?.({ open: isOpen.value }), props.asChild)
    }
  },
})

const Icon = defineComponent({
  name: "AlertIcon",
  inheritAttrs: false,
  props: {
    /** Names the icon (`role="img"`), so the severity is in the alert's text ("Error"). */
    label: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAlert("Icon")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.connect().icon(props.label)), attrs),
        slots.default?.({ open: ctx.open() }),
        props.asChild,
      )
  },
})

function textPart(
  name: "Title" | "Description",
  own: (ctx: Ctx) => ReturnType<Ctx["connect"]>["title"],
) {
  return defineComponent({
    name: `Alert${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useAlert(name)
      return () =>
        renderPart(
          "div",
          mergeProps(normalizeProps(own(ctx)()), attrs),
          slots.default?.({ open: ctx.open() }),
          props.asChild,
        )
    },
  })
}
const Title = textPart("Title", (ctx) => ctx.connect().title)
const Description = textPart("Description", (ctx) => ctx.connect().description)

/** Whether rendered content has text (an icon-only trigger has none). */
function hasText(children: VNodeChild): boolean {
  const list = Array.isArray(children) ? children : [children]
  return list.some((child): boolean => {
    if (typeof child === "string") return child.trim() !== ""
    if (typeof child === "number") return true
    if (!isVNode(child)) return false
    const hidden = (child.props as { "aria-hidden"?: unknown } | null)?.["aria-hidden"]
    // Hidden text does not name the button.
    if (hidden === true || hidden === "true") return false
    return typeof child.children === "string"
      ? child.children.trim() !== ""
      : hasText(child.children as VNodeChild)
  })
}

const CloseTrigger = defineComponent({
  name: "AlertCloseTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAlert("CloseTrigger")
    const env = useEnvironment()
    // Modality tracking runs while a trigger is mounted, so focus-visible is known on focus.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    return () => {
      const children = slots.default?.({ open: ctx.open() })
      const named =
        attrs["aria-label"] !== undefined ||
        attrs["aria-labelledby"] !== undefined ||
        hasText(children)
      const own = normalizeProps(
        ctx.connect().closeTrigger({ named, focused: focused.value, modality: modality.value }),
      )
      const merged = mergeProps(
        joinHandlers(own, {
          onFocusin: () => (focused.value = true),
          onFocusout: () => (focused.value = false),
          onClick: () => {
            const r = ctx.root.value
            const active = r?.ownerDocument.activeElement
            ctx.send({ type: "CLOSE", focusInside: !!r && !!active && r.contains(active) })
          },
        }),
        attrs,
      )
      return renderPart("button", merged, children, props.asChild)
    }
  },
})

/** The parts, by name: `alert.parts.ts` re-exports them as the `Alert` namespace. */
export { CloseTrigger, Description, Icon, Root, Title }
