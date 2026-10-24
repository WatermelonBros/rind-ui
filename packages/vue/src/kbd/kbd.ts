import {
  type KbdItem,
  type KbdKeys,
  type KbdMessages,
  kbdConnect,
  kbdMessages,
  keyShortcuts,
  type MessageOverrides,
  parseKeys,
} from "@rind-ui/core"
import {
  type ComputedRef,
  computed,
  defineComponent,
  h,
  onMounted,
  type PropType,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    kbd: KbdMessages
  }
}

/** What every part's default slot receives. */
export interface KbdRenderState {
  readonly platform: "apple" | "other"
}

/**
 * The platform: the prop, else the environment's after mount; server and hydration render
 * "other", so the first client render matches the server's HTML.
 */
function usePlatform(own: () => "apple" | "other" | undefined): ComputedRef<"apple" | "other"> {
  const env = useEnvironment()
  const detected = shallowRef<"apple" | "other">("other")
  onMounted(() => (detected.value = env.platform.apple ? "apple" : "other"))
  return computed(() => own() ?? detected.value)
}

/**
 * The `aria-keyshortcuts` value for the control a shortcut activates, from the same keys a
 * Kbd shows, on the environment's platform (`undefined` for a sequence). Call it in setup.
 */
export function useKeyShortcuts(
  keys: () => KbdKeys,
  platform: () => "apple" | "other" | undefined = () => undefined,
): ComputedRef<string | undefined> {
  const resolved = usePlatform(platform)
  return computed(() => keyShortcuts(keys(), resolved.value === "apple"))
}

const Root = defineComponent({
  name: "KbdRoot",
  inheritAttrs: false,
  props: {
    /** "mod+shift+p" (a chord), "g i" (a sequence), or one chord's key names. */
    keys: [String, Array] as PropType<KbdKeys>,
    /** Overrides the environment's platform. */
    platform: String as PropType<"apple" | "other">,
    messages: Object as PropType<MessageOverrides<KbdMessages>>,
    id: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: KbdRenderState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const instance = useRootId(() => props.id)
    const messages = useMessages("kbd", kbdMessages, () => props.messages)
    const platform = usePlatform(() => props.platform)
    return () => {
      const api = kbdConnect({
        instance: instance(),
        chords: props.keys === undefined ? [] : parseKeys(props.keys),
        apple: platform.value === "apple",
        messages: messages.value,
      })
      const state: KbdRenderState = { platform: platform.value }
      const hidden = normalizeProps(api.hiddenProps())
      const item = (it: KbdItem, i: number) =>
        it.type === "key"
          ? h("kbd", { key: i, ...normalizeProps(api.key(it.key)) }, [
              h("span", normalizeProps(api.glyph(it.key)), it.key.glyph),
              api.keyLabel(it.key) === null ? null : h("span", hidden, api.keyLabel(it.key) ?? ""),
            ])
          : h("span", { key: i, ...normalizeProps(api.separator(it.kind)) }, [
              h("span", { "aria-hidden": "true" }, api.separatorText(it.kind)),
              h("span", hidden, api.separatorSpoken(it.kind)),
            ])
      const content = props.keys === undefined ? slots.default?.(state) : api.items.map(item)
      const merged = mergeProps(
        { ...normalizeProps(api.root()), ...(props.id === undefined ? {} : { id: props.id }) },
        attrs,
      )
      return renderPart("kbd", merged, content, props.asChild)
    }
  },
})

/** The parts, by name: `kbd.parts.ts` re-exports them as the `Kbd` namespace. */
export { Root }
