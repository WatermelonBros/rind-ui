import {
  activateLink,
  focusAttrs,
  type Href,
  type LinkCurrent,
  type LinkEnv,
  type LinkInput,
  linkConnect,
  type RouterOptions,
  warnInteractiveContent,
  warnLinkFallback,
} from "@rind-ui/core"
import {
  defineComponent,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, elements, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

export interface LinkState {
  readonly disabled: boolean
  readonly current: boolean
  readonly pressed: boolean
  readonly hovered: boolean
  readonly focusVisible: boolean
}

/** A navigational link (openspec link, link-navigation). Stateless: no machine. */
export const Link = defineComponent({
  name: "RindLink",
  inheritAttrs: false,
  props: {
    /** Typed by `RouterConfig` (augmentable). */
    href: [String, Object] as PropType<Href>,
    target: String,
    rel: String,
    /** Download instead of navigating (the browser handles it); a string names the file. */
    download: { type: [Boolean, String], default: undefined },
    ping: String,
    referrerpolicy: String as PropType<LinkInput["referrerPolicy"]>,
    hreflang: String,
    /** Passed unchanged to the router's `navigate`. */
    // Any value: RouterOptions is `never` until the app augments RouterConfig.
    routerOptions: null as unknown as PropType<RouterOptions>,
    /** No `href`, `aria-disabled`, out of the Tab order (unless `focusableWhenDisabled`). */
    disabled: Boolean,
    /** Keeps a disabled link in the Tab order (it stays `aria-disabled`). */
    focusableWhenDisabled: { type: Boolean, default: undefined },
    /** Sets `aria-current` and `data-current`; the link still navigates. */
    current: { type: [Boolean, String] as PropType<LinkCurrent>, default: undefined },
    id: String,
    ...asChildProp,
  },
  emits: {
    /** Once per activation that is not disabled or prevented, with where it opened. */
    activate: (_details: Parameters<NonNullable<LinkInput["onActivate"]>>[0]) => true,
  },
  slots: Object as SlotsType<{ default?: (state: LinkState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    // Unknown on the server and while hydrating, so both renders agree on data-external.
    const origin = shallowRef<string | undefined>(undefined)
    const focused = shallowRef(false)
    const check = () => {
      const node = el.value
      measured.value = node?.tagName.toLowerCase() ?? null
      if (!node) return
      warnLinkFallback(node)
      warnInteractiveContent(node, "link")
    }
    onMounted(() => {
      origin.value = globalThis.location?.origin
      check()
      // The tracker must see the pointerdown before focus, or a click looks like keyboard focus.
      onBeforeUnmount(env.modality.subscribe(() => {}))
    })
    onUpdated(check)
    // The latest render's input and env, for the press handler.
    let input: LinkInput | undefined
    let linkEnv: LinkEnv = env
    let tag = "a"
    const press = usePress({
      env,
      disabled: () => props.disabled,
      send: (e) => {
        // A native anchor activates through its own click; the fallback through the routine.
        if (e.type === "PRESS" && tag !== "a" && el.value && input)
          activateLink(input, el.value, e, linkEnv)
      },
    })
    const hover = useHover({ env, disabled: () => props.disabled, send: () => {} })
    const modality = useModality(env.modality, () => focused.value)
    return () => {
      const focus = focusAttrs(focused.value, modality.value)
      const state: LinkState = {
        disabled: props.disabled,
        current: props.current !== undefined && props.current !== false,
        pressed: press.pressed.value,
        hovered: hover.hovered.value,
        focusVisible: focus["data-focus-visible"] !== undefined,
      }
      const children = slots.default?.(state)
      tag = renderedTag("a", children, props.asChild, measured.value)
      // A rendered component (a router's link) navigates itself (react-spectrum#2525).
      const childType = props.asChild ? elements(children ?? null)[0]?.type : undefined
      const ownsNavigation = childType !== undefined && typeof childType === "object"
      linkEnv = ownsNavigation ? { ...env, router: undefined } : env
      input = {
        href: props.href,
        target: props.target,
        rel: props.rel,
        download: props.download,
        ping: props.ping,
        referrerPolicy: props.referrerpolicy,
        hrefLang: props.hreflang,
        routerOptions: props.routerOptions,
        disabled: props.disabled,
        focusableWhenDisabled: props.focusableWhenDisabled,
        current: props.current,
        onActivate: (details) => emit("activate", details),
        origin: origin.value,
        tag,
      }
      const own = normalizeProps({
        ...linkConnect({ ...input, instance: instance() }, linkEnv),
        ...focus,
        "data-pressed": press.pressed.value ? "" : undefined,
        "data-hover": hover.hovered.value ? "" : undefined,
      })
      const { onClick, ...rest } = attrs
      const merged = mergeProps(
        {
          ...joinHandlers(own, press.props, hover.props, {
            onFocusin: () => (focused.value = true),
            onFocusout: () => (focused.value = false),
          }),
          ...(props.id === undefined ? {} : { id: props.id }),
          ref: refTo(el),
        },
        rest,
        // A disabled link drops the consumer's click listener (link-navigation "Disabled Links").
        props.disabled ? {} : { onClick },
      )
      return renderPart("a", merged, children, props.asChild)
    }
  },
})
